/**
 *  ADOBE CONFIDENTIAL
 *  __________________
 *
 *  Copyright 2019 Adobe Systems Incorporated
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

class DevToolCommand extends BaseCommand {
    async run() {
        const { flags } = this.parse(DevToolCommand);
        return new Promise((resolve, reject) => {
            const port = flags.port;
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
