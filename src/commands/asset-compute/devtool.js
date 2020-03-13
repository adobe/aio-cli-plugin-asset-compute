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
const app = require('@nui/asset-compute-dev-tool/app');
const http = require('http');
const { createHttpTerminator } = require('http-terminator');
const util = require('../../lib/util');
const open = require('open');

/**
 * Event listener for HTTP server "listening" event.
 */
async function onListening(server) {
    const addr = server.address();
    const bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    util.log('Listening on ' + bind);
    util.log(`Opening http://localhost:${addr.port}`);
    await open(`http://localhost:${addr.port}`);
}

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
    const port = parseInt(val, 10);

    if (isNaN(port)) {
      // named pipe
      return val;
    }

    if (port >= 0) {
      // port number
      return port;
    }

    return false;
  }

class DevToolCommand extends BaseCommand {
    async run() {
        const { flags } = this.parse(DevToolCommand);
        return new Promise((resolve, reject) => {
            const port = normalizePort(process.env.ASSET_COMPUTE_DEV_PORT || flags.port);
            app.set('port', port);

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
            server.on('listening', () => onListening(server));
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
}

module.exports = DevToolCommand
