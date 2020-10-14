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

const util = require('util');
const child_process = require('child_process');
const exec = util.promisify(child_process.exec);
const spawn = child_process.spawn;
const path = require('path');
const debug = require('debug')('aio-asset-compute.mockserver');


const MOCK_SERVER_IMAGE = 'mockserver/mockserver:mockserver-5.11.1';

// "mock-upload.wikimedia.org.json" => "upload.wikimedia.org"
function getHostName(file) {
    file = path.basename(file, path.extname(file));
    if (file.startsWith("mock-")) {
        file = file.substring("mock-".length);
    }
    return file;
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
            await this._dockerSpawnLogs();
        } catch (e) {
            await this.stop(true);
            if(e.message){
                throw new Error(`error starting mock container '${this.container}': ${e.message}`);
            } 
            // else
            console.log(e);
            throw new Error(`error starting mock container '${this.container}': ${e}`);
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

    async stop(ignoreErrors) {
        try {
            await exec(`docker stop --time 15 ${this.container}`);
        } catch (e) {
            if (!ignoreErrors) {
                console.error(`error shutting down mock container '${this.container}': ${e.message}`);
            }
        }
        try {
            await exec(`docker network disconnect --force ${this.network} ${this.workerContainerName}`);
        } catch (e) {
            if (!ignoreErrors) {
                console.error(`error disconnecting mock network '${this.network}' from '${this.workerContainerName}': ${e.message}`);
            }
        }
        try {
            await exec(`docker network rm ${this.network}`);
        } catch (e) {
            if (!ignoreErrors) {
                console.error(`error removing mock network '${this.network}': ${e.message}`);
            }
        }
    }

    /**
     * Spawn docker logs until mocks are set up
     */
    async _dockerSpawnLogs() {
        return new Promise((resolve, reject) => {

            debug(`> docker logs -f ${this.container}`);
            const proc = spawn('docker', ['logs', '-f', this.container]);

            proc.stdout.on('data', function(data) {
                const stdout = data.toString();
                debug(stdout);
                if (stdout && stdout.includes('started on ports: [80, 443]')) {
                    proc.kill();
                    resolve(true);
                }
            });

            // wait limited time
            const waitLimit = 15000;
            setTimeout(() => {
                // end spawned process
                proc.kill();
                reject(`Error setting up container (stopped after waiting for ${waitLimit}ms)`);
            }, waitLimit);
        });
    }
}

MockServer.NETWORK_PREFIX = "mock-network-";
MockServer.CONTAINER_PREFIX = "mock-server-";

module.exports = MockServer;
