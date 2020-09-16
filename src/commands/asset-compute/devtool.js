/*
 * Copyright 2020 Adobe. All rights reserved.
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

const { DevtoolServer } = require('@adobe/asset-compute-devtool');
const { createHttpTerminator } = require('http-terminator');
const BaseCommand = require('../../base-command');
const { flags } = require('@oclif/command');
const util = require('../../lib/util');

class DevToolCommand extends BaseCommand {

    async run() {
        const { flags } = this.parse(DevToolCommand); // eslint-disable-line no-unused-vars
        this.devtool = new DevtoolServer();
        await this.devtool.run(flags.port);
        const httpTerminator = createHttpTerminator({ server: this.devtool.server });

        this.onProcessExit(async () => {
            util.log("Stopping Asset Compute Developer Tool Server");
            httpTerminator.terminate();
        });
    }

    async stop() {
        return this.devtool.stop();
    }
}

DevToolCommand.description = 'Starts the Asset Compute Developer Tool';

DevToolCommand.flags = {
    port: flags.integer({
        description: 'Http port of the Asset Compute Developer Tool Server',
        default: 9000
    }),
    ...BaseCommand.flags
};

module.exports = DevToolCommand;
