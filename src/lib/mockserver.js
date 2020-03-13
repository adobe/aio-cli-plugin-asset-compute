/**
 *  ADOBE CONFIDENTIAL
 *  __________________
 *
 *  Copyright 2020 Adobe Systems Incorporated
 *  All Rights Reserved.
 *
 *  NOTICE:  All information contained herein is, and remains
 *  the property of Adobe Systems Incorporated and its suppliers,
 *  if any.  The intellectual and technical concepts contained
 *  herein are proprietary to Adobe Systems Incorporated and its
 *  suppliers and are protected by trade secret or copyright law.
 *  Dissemination of this information or reproduction of this material
 *  is strictly forbidden unless prior written permission is obtained
 *  from Adobe Systems Incorporated.
 */

'use strict';

const util = require('util');
const exec = util.promisify(require('child_process').exec);
const path = require('path');
const { logToFile } = require('./util');

const MOCK_SERVER_IMAGE = 'mockserver/mockserver:mockserver-5.8.1';

function asContainerName(name) {
	// docker container names are restricted to [a-zA-Z0-9][a-zA-Z0-9_.-]*

	// 1. replace special characters with dash
	name = name.replace(/[^a-zA-Z0-9_.-]+/g, '-');
	// 2. leading character is more limited
	name = name.replace(/^[^a-zA-Z0-9]+/g, '');
	// 3. (nice to have) remove trailing special chars
	name = name.replace(/[^a-zA-Z0-9]+$/g, '');

	return name;
}

function getHostName(file) {
	return file.substring(5, file.length - 5);
}

// Sleep in milliseconds
function sleep(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}


/**
 * Poll docker logs until expectations and ports are set up
 * @param {Integer} index index of mock-server container
 */
async function waitUntilReady(index) {
	let count = 1;
	while (count <= 10) {
		await sleep(500 * count); // to account for cold starts
		const logs = await exec(`docker logs mock-server-${index}`);
		const portIsRunning = logs.stdout.includes('started on ports: [80, 443]');
		if (portIsRunning) {
			logToFile('Mock server is running on ports 80,443');
			return true;
		}
		count++;
	}
}


/**
 * Search through current test case directory to see if there is a file of form `mock-*.json`
 * @returns {Array} mock file paths
 */
async function setUpMocks(httpMocks, name) {
	let index = 0;
	try {
		if (!httpMocks) {
			return;
		}
		// get worker container name
		const workerContainerName = asContainerName(name);

		for (const mockFile of httpMocks) {
			await preCleanCheck(index, workerContainerName);
			const fileName = path.basename(mockFile);
			// get domain name from mock file
			const hostName = getHostName(fileName);
			const runMockContainer = `docker run \
							--rm \
							-d \
							-u root \
							-v ${path.dirname(mockFile)}:/mocks \
							--name mock-server-${index} \
							-e MOCKSERVER_INITIALIZATION_JSON_PATH=/mocks/${fileName} \
							-e MOCKSERVER_SSL_CERTIFICATE_DOMAIN_NAME=${hostName} \
							${MOCK_SERVER_IMAGE} \
							-serverPort 80,443`;
			const { stdout, stderr } = await exec(runMockContainer);
			logToFile(`Started container mock-server-${index}`);
			logToFile('- id      :', stdout.trim());
			logToFile('- image   :', MOCK_SERVER_IMAGE);
			logToFile('- hostname:', hostName);
			if (stderr) {
				logToFile('stderr:', stderr);
			}

			await waitUntilReady(index);

			// create network and connect worker and mock-server containers to network
			try {
				await exec(`docker network create mock-network-${index}`);

			} catch (e) {
				// ignore if network is already created
			}
			await exec(`docker network connect mock-network-${index} mock-server-${index} --alias ${hostName}`);
			await exec(`docker network connect mock-network-${index} ${workerContainerName}`);

			index++;
		}
		return index;
	} catch (e) {
		logToFile(e);
		return index;
	}
}

async function stopMocks(amount, name) {
	const containerName = asContainerName(name);
	try {
		let index = 0;
		while (index < amount) {
			await exec(`docker stop mock-server-${index}`);
			// disconnect mock-server and worker from network and remove network
			await exec(`docker network disconnect mock-network-${index} ${containerName}`);
			await exec(`docker network rm mock-network-${index}`);
			index++;
		}

	} catch (e) {
		logToFile('error shutting down mock container or network: ', e);
	}
	await sleep(2000); // wait while container shuts down
}

async function preCleanCheck(index, containerName) {
	try {
		await exec(`docker stop mock-server-${index}`);
	} catch (e) {
		// ignore if no docker container running
	}
	try {
		await exec(`docker network disconnect mock-network-${index} ${containerName}`);
	} catch (e) {
		// ignore if no docker container running
	}
	try {
		await exec(`docker network rm mock-network-${index}`);
	} catch (e) {
		// ignore if no docker container running
	}

}
module.exports = {
	setUpMocks,
	stopMocks
}