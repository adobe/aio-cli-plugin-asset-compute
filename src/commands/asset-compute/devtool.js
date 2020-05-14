/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

'use strict';

const BaseCommand = require('../../base-command');
const { flags } = require('@oclif/command');
const app = require('@adobe/asset-compute-devtool/app');
const http = require('http');
const { createHttpTerminator } = require('http-terminator');
const util = require('../../lib/util');
const open = require('open');
const getPort = require('get-port');
const crypto = require("crypto");

/**
 * Event listener for HTTP server "listening" event.
 */
async function onListening(server, randomString) {
    const addr = server.address();
    const bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    util.log('Listening on ' + bind);
    const assetComputeDevToolUrl = `http://localhost:${addr.port}/?devToolToken=${randomString}`;
    console.log('Asset Compute Developer Tool Server started on url ', assetComputeDevToolUrl);
    await open(assetComputeDevToolUrl);
}

/**
 * Normalize a port into a number, string, or false.
 */
async function findOpenPort(preferredPort) {
    return getPort({port: [preferredPort, preferredPort + 1, preferredPort + 2]});
    // Will use specified port if available, otherwise fall back to a random port
}

class DevToolCommand extends BaseCommand {
    async run() {
        const { flags } = this.parse(DevToolCommand);
        const port = await findOpenPort(flags.port);

        // random string for developer tool authorization token
        let randomString;
        try {
            randomString = crypto.randomBytes(32).toString("hex");
        } catch(e) {
            console.log(e);
            throw new Error('Error: Not enough accumulated entropy to generate cryptographically strong data.');
        }
        return new Promise((resolve, reject) => {
            app.set('port', port);
            app.set('devToolToken', randomString);

            // Create HTTP server.
            util.log('Starting Asset Compute Developer Tool Server on port ', port);
            const server = http.createServer(app);
            const httpTerminator = createHttpTerminator({ server });

            // Listen on provided port, on all network interfaces.
            server.listen(port);
            server.on('error', error => {
                if (error.syscall !== 'listen') {
                    return reject(error);
                }

                // handle specific listen errors with friendly messages
                const bind = typeof port === 'string'
                    ? 'Pipe ' + port
                    : 'Port ' + port;
                switch (error.code) {
                case 'EACCES':
                    util.logError(bind + ' requires elevated privileges');
                    break;
                case 'EADDRINUSE':
                    util.logError(bind + ' is already in use');
                    break;
                }
                return reject(error);
            });
            server.on('listening', () => onListening(server, randomString));
            server.on('close', () => {
                util.log("Asset Compute Developer Tool Server Stopped");
                process.exit();
            });
            process.on('SIGINT', function() {
                util.log("Stopping Asset Compute Developer Tool Server");
                httpTerminator.terminate();
            });
        });
    }
}

DevToolCommand.description = 'Runs the Asset Compute Developer Tool UI';

DevToolCommand.flags = {
    port: flags.integer({
        description: 'Http port of the Asset Compute Developer Tool Server',
        default: 9000
    }),
    ...BaseCommand.flags
};

module.exports = DevToolCommand;
