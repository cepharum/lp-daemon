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

const { Transform, PassThrough } = require( "stream" );
const Debug = require( "debug" )( "tokenizer" );
const Noisy = require( "debug" )( "tokenizer-debug" );


/**
 * @typedef {object} LprCommand
 * @property {RequestContext} context storage for collecting information successively received in a single request
 * @property {string} type either "command" or "subcommand"
 * @property {int} command octet value indicating command to process
 * @property {Buffer[]} operands list of operands to requested command
 */

/**
 * @typedef {object} LprData
 * @property {RequestContext} context storage for collecting information successively received in a single request
 * @property {string} type "data"
 * @property {Readable} stream stream providing chunks of data
 */

/**
 * @typedef {object} LprEndOfRequest
 * @property {RequestContext} context storage for collecting information successively received in a single request
 * @property {string} type "eof"
 */

/**
 * @typedef {LprCommand|LprData|LprEndOfRequest} RequestTokenizerOutput
 */


/**
 * Implements parser splitting incoming stream of octets into parsed commands.
 */
class RequestTokenizer extends Transform {
	/**
	 * @param {RequestContext} requestContext context collecting information successively received in same request
	 * @param {object} streamOptions options customizing stream
	 */
	constructor( requestContext, streamOptions = {} ) {
		super( Object.assign( {}, streamOptions, {
			writableObjectMode: false,
			readableObjectMode: true,
			objectMode: false,
		} ) );

		/**
		 * Stores currently detected command while collecting related information
		 * from input stream.
		 *
		 * @type {?int}
		 * @private
		 */
		this._command = null;

		/**
		 * Lists operands to current command found in input stream.
		 *
		 * @type {string[]}
		 * @private
		 */
		this._operands = [];

		/**
		 * Lists octets read before while extracting (another) operand to current
		 * command.
		 *
		 * @type {int[]}
		 * @private
		 */
		this._partial = [];

		/**
		 * Provides number of octets tokenizer is still expecting.
		 *
		 * @type {int} number of octets to be received
		 * @private
		 */
		this._dataBytes = 0;

		/**
		 * Caches stream used to pipe some currently processed data block of
		 * incoming request.
		 *
		 * @type {?PassThrough}
		 * @private
		 */
		this._data = null;

		/**
		 * Marks if stream is considered finished thus rejecting to process any
		 * further input.
		 *
		 * @type {boolean}
		 */
		let finished = false;

		/**
		 * Marks if stream is processing sub commands.
		 *
		 * @type {boolean}
		 */
		let processSubCommands = false;


		Object.defineProperties( this, {
			/**
			 * Indicates if this parser is processing sub commands in addition
			 * to some initial command.
			 *
			 * @note In lp every request is designed to process a single
			 *       command, only, with one command supporting an additional
			 *       sequence of sub commands. This flag is set in this case and
			 *       can't be cleared again afterwards. Flag can be set unless
			 *       `metEndOfCommand` has been set before.
			 *
			 * @name RequestTokenizer#handleSubCommands
			 * @property {boolean}
			 */
			handleSubCommands: {
				get: () => processSubCommands,
				set: () => {
					if ( !finished ) {
						processSubCommands = true;
					}
				},
			},

			/**
			 * Indicates whether parser has finished looking for commands or not.
			 *
			 * @note This flag can be set any time but can't be cleared
			 *       afterwards again. It is used to indicate stream having
			 *       processed full command thus requiring another request/stream
			 *       to process any further input.
			 *
			 *       Setting this flag prevents `handleSubCommands` from being
			 *       set afterwards.
			 *
			 * @name RequestTokenizer#metEndOfCommand
			 * @property {boolean}
			 */
			metEndOfCommand: {
				get: () => finished,
				set: () => ( finished = true ),
			},

			/**
			 * Provides unique ID of request this tokenizer is attached to for
			 * parsing incoming data.
			 *
			 * @note The ID is unique in context of current runtime, only
			 *
			 * @name RequestTokenizer#requestId
			 * @property {int}
			 * @readonly
			 */
			requestId: { value: parseInt( requestContext.requestId ) },

			/**
			 * Provides context of request this tokenizer is attached to for
			 * parsing incoming data.
			 *
			 * @note The context if provided to process multiple tokens emitted
			 *       by this tokenizer in an attached processor of such tokens.
			 *       Thus reference on context is included with every emitted
			 *       token.
			 *
			 * @name RequestTokenizer#requestContext
			 * @property {object}
			 * @readonly
			 */
			requestContext: { value: requestContext },
		} );


		this.on( "error", error => {
			if ( this._data ) {
				this._data.emit( "error", error );
			}
		} );

		this.on( "end", () => {
			if ( this._data ) {
				this._data.end();
				this._data = null;

				if ( ( this._dataBytes > 0 && this._dataBytes < Infinity ) || ( this._data && this._data._expectConfirmationFromLpClient ) ) {
					this.emit( "error", new Error( `input stream prematurely closed while reading another ${this._dataBytes} octet(s) of data` ) );
				}
			}
		} );
	}

	/**
	 * Parses sequence of input bytes feeding some object written to describe
	 * received input bytes.
	 *
	 * @param {Buffer} chunk chunk of octets to be parsed
	 * @param {string} encoding encoding of provided chunk, not used here
	 * @param {function(error:?Error=, resultingObject:?object=)} callback callback invoked on error or when whole chunk has been processed
	 * @returns {void}
	 * @private
	 */
	_transform( chunk, encoding, callback ) {
		const numBytes = chunk.length;
		let read = 0;

		Noisy( `received ${numBytes} octet(s) in request ${this.requestId} while ${this.metEndOfCommand ? "not expecting any more input" : this._data ? this._data._expectConfirmationFromLpClient ? "waiting for data completion mark" : "passing data" : "reading commands"}` );

		while ( read < numBytes ) {
			if ( this.metEndOfCommand ) {
				callback( new Error( "invalid extra data in input stream past command" ) );
				return;
			}

			if ( this._data ) {
				// currently forwarding incoming data using pass-through stream
				if ( this._data._expectConfirmationFromLpClient ) {
					const markCompleted = chunk[read++] === 0;

					Debug( `client marks transmitted content as ${markCompleted ? "complete" : "incomplete"}` );

					if ( !markCompleted ) {
						this._data.emit( "error", Object.assign( new Error( "LP client apparently failed to transmit complete content" ), { code: "EPIPE" } ) );
					}

					this._data.end();
					this._data = null;

					if ( !this.handleSubCommands ) {
						this.metEndOfCommand = true;
					}
				} else {
					const chunkSize = Math.min( numBytes - read, this._dataBytes );

					this._data.write( chunk.slice( read, read + chunkSize ) );

					if ( this._dataBytes < Infinity ) {
						this._dataBytes -= chunkSize;
					}

					read += chunkSize;

					if ( this._dataBytes === 0 ) {
						// met end of data -> drop forwarding stream and return to
						// command detection
						this._data._expectConfirmationFromLpClient = true;
					}
				}

				continue;
			}

			if ( this._command == null ) {
				this._command = chunk[read++];

				Debug( `got start of ${this.handleSubCommands ? "subcommand" : "command"} 0x${( "0" + this._command.toString( 16 ) ).slice( -2 )} in request ${this.requestId}` );
			} else {
				const { _command: command, _operands: operands, _partial: partial } = this;

				const ch = chunk[read++];

				switch ( ch ) {
					case 0x09 :
					case 0x0b :
					case 0x0c :
					case 0x20 : {
						// end of previous operand
						if ( partial.length > 0 ) {
							const operand = Buffer.from( partial );
							operands.push( operand );
							partial.splice( 0 );

							Debug( `got operand #${operands.length} to ${this.handleSubCommands ? "subcommand" : "command"} 0x${( "0" + command.toString( 16 ) ).slice( -2 )}: "${operand.toString( "ascii" )}" in request ${this.requestId}` );
						}

						break;
					}

					case 0x0a : {
						// end of command
						const type = this.handleSubCommands ? "subcommand" : "command";

						this._command = null;
						this._operands = [];

						if ( partial.length > 0 ) {
							const operand = Buffer.from( partial );
							operands.push( operand );
							partial.splice( 0 );

							Debug( `got operand #${operands.length} to ${this.handleSubCommands ? "subcommand" : "command"} 0x${( "0" + command.toString( 16 ) ).slice( -2 )}: "${operand.toString( "ascii" )}" in request ${this.requestId}` );
						}

						Debug( `sending ${type} 0x${( "0" + command.toString( 16 ) ).slice( -2 )} with ${operands.length} operand(s) in request ${this.requestId}` );

						this.push( {
							type,
							command,
							operands,
							context: this.requestContext,
						} );


						if ( this.handleSubCommands ) {
							switch ( command ) {
								case 0x02 :
								case 0x03 : {
									if ( operands.length < 1 ) {
										callback( new Error( "missing operand providing size of data file" ) );
										return;
									}

									let count = operands[0].toString( "ascii" );
									if ( !/^\d+$/.test( count ) ) {
										callback( new Error( "invalid operand providing size of data file" ) );
										return;
									}

									count = parseInt( count );

									this._data = new PassThrough();
									this._dataBytes = count > 0 && count !== 125899906843000 ? count : Infinity;

									Debug( `sending start of data expecting ${count || Infinity} octet(s) in request ${this.requestId}` );

									this.push( {
										type: "data",
										stream: this._data,
										context: this.requestContext,
									} );
									break;
								}
							}
						} else if ( command === 0x02 ) {
							// got request command for receiving print job
							// requiring additional information provided in
							// sub commands
							this.handleSubCommands = true;
						} else {
							// having processed any other command no further
							// input is expected
							this.metEndOfCommand = true;

							if ( read < numBytes ) {
								callback( new Error( "invalid extra data in input stream past command" ) );
								return;
							}
						}

						break;
					}

					default :
						this._partial.push( ch );
				}
			}
		}

		Noisy( `processed ${numBytes} octet(s) in request ${this.requestId} eventually ${this.metEndOfCommand ? "not expecting any more input" : this._data ? this._data._expectConfirmationFromLpClient ? "waiting for data completion mark" : "passing data" : "reading commands"}` );

		callback();
	}

	/**
	 * Emits some final token marking end of request unless stream has been
	 * closed prematurely.
	 *
	 * @param {function(?Error=,object=)} callback callback to continue closing stream asynchronously
	 * @returns {void}
	 * @protected
	 */
	_flush( callback ) {
		if ( this._partial.length > 0 || this._command != null || this._operands.length > 0 ) {
			const msg = `premature end of request #${this.requestId}`;
			Debug( `ERROR: ${msg}` );
			callback( new Error( msg ) );
		} else if ( this._data && this._dataBytes < Infinity && !this._data._expectConfirmationFromLpClient ) {
			const msg = `premature end of data transmission in request #${this.requestId}`;
			Debug( `ERROR: ${msg}` );
			callback( new Error( msg ) );
		} else {
			callback( null, {
				type: "eof",
				context: this.requestContext,
			} );
		}
	}
}

module.exports = RequestTokenizer;
