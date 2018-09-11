/**
 * (c) 2018 cepharum GmbH, Berlin, http://cepharum.de
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2018 cepharum GmbH
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * @author: cepharum
 */

"use strict";

const HTTP = require( "http" );
const URL = require( "url" );

const Debug = require( "debug" )( "ipp-backend" );
const IPP = require( "ipp-message" );

const AbstractBackend = require( "./abstract" );


let nextRequestId = 1;


/**
 * Implements backend passing requests to remote service via IPP.
 */
class IppBackend extends AbstractBackend {
	/**
	 * @param {string} ippServiceUrl base URL of remote IPP service to control
	 * @param {object} options provides options customizing this backend's behaviour
	 */
	constructor( ippServiceUrl, options = {} ) {
		super( options );

		Object.defineProperties( this, {
			/**
			 * Provides base URL of IPP service any request should be forwarded
			 * to.
			 *
			 * @name IppBackend#serviceUrl
			 * @property {string}
			 * @readonly
			 */
			serviceUrl: { value: ippServiceUrl },
		} );
	}

	/**
	 * Compiles URL addressing named queue on remote IPP service.
	 *
	 * @param {string} queue name of job queue to address
	 * @return {string} URL addressing selected job queue
	 */
	getPrinterUrl( queue ) {
		const { serviceUrl } = this;

		if ( serviceUrl.indexOf( "%s" ) > -1 ) {
			return serviceUrl.replace( /%s/g, queue );
		}

		return serviceUrl + ( serviceUrl[serviceUrl.length - 1] === "/" ? "" : "/" ) + queue;
	}

	/** @inheritDoc */
	printJob( queue, jobInformation, dataStream ) {
		return new Promise( ( resolve, reject ) => {
			const queueUrl = this.getPrinterUrl( queue );

			Debug( `printing to ${queueUrl}` );

			const ippMessage = new IPP.IPPMessage();
			ippMessage.version = "1.1";
			ippMessage.code = IPP.OPERATION.PrintJob;
			ippMessage.id = nextRequestId++;
			ippMessage.attributes.operation["attributes-charset"] = IPP.generators.generateCharset( "utf-8" );
			ippMessage.attributes.operation["attributes-natural-language"] = IPP.generators.generateNaturalLanguage( "en" );
			ippMessage.attributes.operation["printer-uri"] = IPP.generators.generateUri( queueUrl );
			ippMessage.attributes.operation["requesting-user-name"] = IPP.generators.generateNameWithoutLanguage( jobInformation.userId || "anonymous" );
			ippMessage.attributes.operation["job-name"] = IPP.generators.generateNameWithoutLanguage( jobInformation.jobTitle || jobInformation.fileName || "jobfile" );
			ippMessage.attributes.operation["document-format"] = IPP.generators.generateMimeMediaType( "application/octet-stream" );
			ippMessage.attributes.job["job-originating-host-name"] = IPP.generators.generateNameWithoutLanguage( jobInformation.hostName || "127.0.0.1" );

			const httpOptions = URL.parse( queueUrl );
			httpOptions.method = "POST";
			httpOptions.headers = {
				"Content-Type": "application/ipp",
			};

			const request = HTTP.request( httpOptions, res => {
				const chunks = [];

				res.on( "data", chunk => chunks.push( chunk ) );
				res.on( "error", reject );
				res.on( "end", () => {
					const statusCode = parseInt( res.statusCode );
					if ( statusCode > 299 ) {
						reject( new Error( `IPP services responds with HTTP status ${statusCode}` ) );
						return;
					}

					const ippResponse = new IPP.IPPMessage( Buffer.concat( chunks ) );
					if ( ippResponse.code !== IPP.STATUS.successfulOk ) {
						const status = ippResponse.attributes.operation["status-message"];
						reject( new Error( `IPP service responds with IPP status ${ippResponse.code}: ${status ? status[0].value : "<unknown>"}` ) );
						return;
					}

					const jobAttributes = ippResponse.attributes.job;
					if ( jobAttributes && jobAttributes["job-id"] ) {
						const jobId = jobAttributes["job-id"][0].value;

						Debug( `got job ID ${jobId} from ${queueUrl}` );

						resolve( jobId );
					} else {
						Debug( `WARNING: missing job ID in response from ${queueUrl}` );

						resolve( "(null)" );
					}
				} );
			} );

			request.on( "error", reject );

			request.write( ippMessage.toBuffer() );
			dataStream.pipe( request );
		} );
	}

	/** @inheritDoc */
	removeJob( queue, userName, jobIdsOrUserNames = [] ) { // eslint-disable-line no-unused-vars
		return Promise.reject( new Error( "removal of jobs not supported by backend" ) );
	}

	/** @inheritDoc */
	report( queue, brief = true, jobIdsOrUserNames = [] ) { // eslint-disable-line no-unused-vars
		return Promise.reject( new Error( "reports are not supported by backend" ) );
	}

	/** @inheritDoc */
	releaseJobs( queue ) { // eslint-disable-line no-unused-vars
		return Promise.reject( new Error( "releasing jobs not supported by backend" ) );
	}
}

module.exports = IppBackend;
