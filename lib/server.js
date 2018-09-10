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

const Net = require( "net" );
const Debug = require( "debug" )( "server" );

const RequestTokenizer = require( "./tokenizer" );
const RequestProcessor = require( "./processor" );
const AbstractBackend = require( "./backends/abstract" );

let nextRequestId = 1;

module.exports = function( options ) {
	if ( !( options.backend instanceof AbstractBackend ) ) {
		throw new TypeError( "missing backend for processing incoming requests" );
	}

	return new Promise( ( resolve, reject ) => {
		const server = Net.createServer( client => {
			const context = {};

			Object.defineProperties( context, {
				requestId: { value: nextRequestId++ },
			} );

			Debug( `got new connection #${context.requestId} from ${client.remoteAddress}:${client.remotePort}` );

			if ( options.requireValidRemotePort && ( client.remotePort < 721 || client.remotePort > 731 ) ) {
				Debug( "invalid remote port rejected" );
				client.resume();
				client.end( "invalid client port\n" );
				return;
			}

			const tokenizer = new RequestTokenizer( context );
			const processor = new RequestProcessor( options.backend );

			client.on( "error", error => {
				Debug( `ERROR on input stream: ${error.message}` );
			} );

			client.on( "close", () => {
				Debug( `connection #${context.requestId} closed` );
			} );

			tokenizer.on( "error", error => {
				Debug( `ERROR in tokenizer: ${error.message}` );
			} );

			processor.on( "error", error => {
				Debug( `ERROR in processor: ${error.message}` );
			} );

			client.pipe( tokenizer );
			tokenizer.pipe( processor );
			processor.pipe( client );
		} );

		server.on( "error", reject );

		server.listen( 515, () => {
			const addr = server.address();

			Debug( `now listening on ${addr.family} address ${addr.address}:${addr.port}` );

			resolve( server );
		} );
	} );
};
