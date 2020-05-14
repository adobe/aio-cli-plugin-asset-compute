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

const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const sleep = promisify(setTimeout);
const path = require('path');

const MOCK_SERVER_IMAGE = 'mockserver/mockserver:mockserver-5.8.1';

// "mock-upload.wikimedia.org.json" => "upload.wikimedia.org"
function getHostName(file) {
    file = path.basename(file, path.extname(file))
    if (file.startsWith("mock-")) {
        file = file.substring("mock-".length);
    }
    return file;
}

/**
 * Poll docker logs until expectations and ports are set up
 * @param {String} container name of container
 */
async function waitUntilReady(container) {
    let count = 1;
    while (count <= 10) {
        await sleep(100 * count); // to account for cold starts
        const logs = await exec(`docker logs ${container}`);
        const portIsRunning = logs.stdout.includes('started on ports: [80, 443]');
        if (portIsRunning) {
            return true;
        }
        count++;
    }
}

class MockServer {

    constructor(mockFile, workerContainerName) {
        this.mockFile = mockFile;
        this.workerContainerName = workerContainerName;

        this.host = getHostName(this.mockFile);
        this.network = `mock-network-${this.host}`;
        this.container = `mock-server-${this.host}`;
    }

    async start() {
        // ensure mocks are removed if still left over (ignore errors, usually they won't exist)
        await this.stop(true);

        try {
            await this._startMockServer();
        } catch (e) {
            await this.stop(true);

            throw new Error(`error starting mock container '${this.container}': ${e.message}`);
        }

        await waitUntilReady(this.container);

        await this._setupNetwork();
    }

    async _startMockServer() {
        const fileName = path.basename(this.mockFile);

        const dockerRun = `docker run \
            --rm \
            -d \
            -u root \
            -v ${path.dirname(this.mockFile)}:/mocks \
            --name ${this.container} \
            -e MOCKSERVER_INITIALIZATION_JSON_PATH=/mocks/${fileName} \
            -e MOCKSERVER_SSL_CERTIFICATE_DOMAIN_NAME=${this.host} \
            ${MOCK_SERVER_IMAGE} \
            -serverPort 80,443`;

        const { stdout, stderr } = await exec(dockerRun);

        console.log(`Started container ${this.container}`);
        console.log('- id      :', stdout.trim());
        console.log('- image   :', MOCK_SERVER_IMAGE);
        console.log('- hostname:', this.host);
        if (stderr) {
            console.error('stderr:', stderr);
        }
    }

    async _setupNetwork() {
        // create network and connect worker and mock-server containers to network
        try {
            await exec(`docker network create ${this.network}`);
        } catch (e) {
            // ignore if network is already created
        }
        await exec(`docker network connect ${this.network} ${this.container} --alias ${this.host}`);
        await exec(`docker network connect ${this.network} ${this.workerContainerName}`);
    }

    async stop(ignorErrors) {
        try {
            await exec(`docker stop ${this.container}`);
        } catch (e) {
            if (!ignorErrors) {
                console.error(`error shutting down mock container '${this.container}': ${e.message}`);
            }
        }
        try {
            await exec(`docker network disconnect ${this.network} ${this.workerContainerName}`);
        } catch (e) {
            if (!ignorErrors) {
                console.error(`error disconnecting mock network '${this.network}' from '${this.workerContainerName}': ${e.message}`);
            }
        }
        try {
            await exec(`docker network rm ${this.network}`);
        } catch (e) {
            if (!ignorErrors) {
                console.error(`error removing mock network '${this.network}': ${e.message}`);
            }
        }
    }
}

module.exports = MockServer;