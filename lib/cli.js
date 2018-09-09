#!/usr/bin/env node
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

const Args = require( "minimist" )( process.argv.slice( 2 ) );
const Debug = require( "debug" )( "cli" );

const Server = require( "./server" );
const { IppBackend, NullBackend } = require( "./backends" );

const options = {};

if ( Args["valid-remote"] ) {
	Debug( `requiring LP requests sent from ports 721-731 in compliance with RFC-1179` );
	options.requireValidRemotePort = true;
}

if ( Args.ipp ) {
	Debug( `selecting IPP backend interacting with IPP service at ${Args.ipp}` );
	options.backend = new IppBackend( Args.ipp );
}

if ( Args.null ) {
	Debug( `selecting null backend just dumping requests` );
	options.backend = new NullBackend();
}


Debug( "starting lp server" );

new Promise( ( resolve, reject ) => {
	Server( options ).then( resolve ).catch( reject );
} )
	.then( server => {
		process.on( "SIGINT", () => {
			Debug( "shutting down server on receiving SIGINT" );

			server.close( () => {
				Debug( "server shut down after receiving SIGINT" );
			} );
		} );
	} )
	.catch( error => {
		Debug( `exception: ${error.message}` );
	} );
