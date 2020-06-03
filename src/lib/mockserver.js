/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

'use strict';

const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const sleep = promisify(setTimeout);
const path = require('path');

const MOCK_SERVER_IMAGE = 'mockserver/mockserver:mockserver-5.8.1';
const MAX_BUFFER_SIZE = 1024 * 10000; // 10MB max buffer size for exec

// "mock-upload.wikimedia.org.json" => "upload.wikimedia.org"
function getHostName(file) {
    file = path.basename(file, path.extname(file));
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
        let logs;
        try {
            logs = await exec(`docker logs ${container}`, { maxBuffer: MAX_BUFFER_SIZE});
        // eslint-disable-next-line no-unused-vars
        } catch (e) {
            throw new Error(`Log output of ${container} too large`);
        }
        const portIsRunning = logs.stdout.includes('started on ports: [80, 443]');
        if (portIsRunning) {
            return true;
        }
        count++;
    }
    throw new Error(`error waiting for mock server container to be ready`);
}

class MockServer {

    constructor(mockFile, workerContainerName) {
        this.mockFile = mockFile;
        this.workerContainerName = workerContainerName;

        this.host      = getHostName(this.mockFile);
        this.network   = `${MockServer.NETWORK_PREFIX}${this.host}`;
        this.container = `${MockServer.CONTAINER_PREFIX}${this.host}`;
    }

    async start() {
        // ensure mocks are removed if still left over (ignore errors, usually they won't exist)
        await this.stop(true);

        try {
            await this._startMockServer();
            await waitUntilReady(this.container);
        } catch (e) {
            await this.stop(true);
            throw new Error(`error starting mock container '${this.container}': ${e.message}`);
        }


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
        } catch (e) { // eslint-disable-line no-unused-vars
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

MockServer.NETWORK_PREFIX = "mock-network-";
MockServer.CONTAINER_PREFIX = "mock-server-";

module.exports = MockServer;
