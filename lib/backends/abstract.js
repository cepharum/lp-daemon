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

/**
 * Implements abstract base class for implementing backend actually performing
 * requests received via LP protocol.
 */
class AbstractBackend {
	/**
	 * @param {object} options options customizing backend's behaviour
	 */
	constructor( options = {} ) {
		Object.defineProperties( this, {
			/**
			 * Exposes options provided on constructing backend to customize its
			 * behaviour.
			 *
			 * @name AbstractBackend#options
			 * @property {object}
			 * @readonly
			 */
			options: { value: options },
		} );
	}

	/**
	 * Handles request for printing job provided through readable stream with
	 * additional job information.
	 *
	 * @param {string} queue name of printer queue
	 * @param {object} jobInformation information on job to be printed
	 * @param {Readable} dataStream non-object readable stream providing job data
	 * @returns {Promise<string>} promises job ID of printed job
	 * @abstract
	 */
	printJob( queue, jobInformation, dataStream ) { // eslint-disable-line no-unused-vars
		return Promise.reject( new Error( "printing jobs not supported by backend" ) );
	}

	/**
	 * Removes print job selected by its ID from selected queue.
	 *
	 * @note Support for removing foreign jobs should be ignored for lack of
	 *       proper security considerations in LP protocol.
	 *
	 * @param {string} queue name of printer queue
	 * @param {string} userName name of user requesting to remove jobs (must be "root" so jobs of other users may be removed)
	 * @param {string[]} jobIdsOrUserNames IDs of jobs to remove explicitly or list of users to remove all jobs owned by them
	 * @returns {Promise<boolean>} promises job removed from queue
	 * @abstract
	 */
	removeJob( queue, userName, jobIdsOrUserNames = [] ) { // eslint-disable-line no-unused-vars
		return Promise.reject( new Error( "removal of jobs not supported by backend" ) );
	}

	/**
	 * Provides information on selected queue optionally limited to given list
	 * of job IDs or user names.
	 *
	 * @param {string} queue name of printer queue
	 * @param {boolean} brief marks whether report should be brief or not
	 * @param {string[]} jobIdsOrUserNames IDs of jobs to remove explicitly or list of users to remove all jobs owned by them
	 * @returns {Promise<string>} promises report as human-readable text
	 * @abstract
	 */
	report( queue, brief = true, jobIdsOrUserNames = [] ) { // eslint-disable-line no-unused-vars
		return Promise.reject( new Error( "reports are not supported by backend" ) );
	}

	/**
	 * Releases all hold jobs in selected queue.
	 *
	 * @param {string} queue name of printer queue
	 * @returns {Promise<boolean>} promises jobs released
	 * @abstract
	 */
	releaseJobs( queue ) { // eslint-disable-line no-unused-vars
		return Promise.reject( new Error( "releasing jobs not supported by backend" ) );
	}
}

module.exports = AbstractBackend;
