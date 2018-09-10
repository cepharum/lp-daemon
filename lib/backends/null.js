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

const Debug = require( "debug" )( "null-backend" );

const AbstractBackend = require( "./abstract" );

let nextJobId = 1;


/**
 * Implements backend passing requests to remote service via IPP.
 */
class NullBackend extends AbstractBackend {
	/**
	 * @param {object} options provides options customizing this backend's behaviour
	 */
	constructor( options = {} ) {
		super( options );
	}

	/** @inheritDoc */
	printJob( queue, jobInformation, dataStream ) {
		dataStream.resume();

		dataStream.on( "error", error => {
			Debug( `stream providing print job data failed: ${error.message}` );
		} );

		Debug( `printing to ${queue} with control data:` );

		const keys = Object.keys( jobInformation );
		const numKeys = keys.length;

		for ( let i = 0; i < numKeys; i++ ) {
			const key = keys[i];

			Debug( ` - ${key} = ${jobInformation[key]}` );
		}

		return Promise.resolve( String( nextJobId++ ) );
	}

	/** @inheritDoc */
	removeJob( queue, userName, jobIdsOrUserNames = [] ) {
		Debug( `removing job${jobIdsOrUserNames.length > 0 ? "s" : ""} of ${queue} for ${userName} matching ${jobIdsOrUserNames.join( ", " )}` );

		return Promise.resolve( true );
	}

	/** @inheritDoc */
	report( queue, brief = true, jobIdsOrUserNames = [] ) {
		Debug( `reporting${brief ? " briefly" : ""} on jobs of ${queue} for matching or being owned by ${jobIdsOrUserNames.join( ", " )}` );

		return Promise.resolve( true );
	}

	/** @inheritDoc */
	releaseJobs( queue ) {
		Debug( `release waiting jobs of ${queue}}` );

		return Promise.resolve( true );
	}
}

module.exports = NullBackend;
