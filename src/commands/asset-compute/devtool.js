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

const BaseCommand = require('../../base-command');
const { flags } = require('@oclif/command');
const devtool = require('@adobe/asset-compute-devtool');


require('dotenv').config;

class DevToolCommand extends BaseCommand {

    async run(port) {
        const { flags } = this.parse(DevToolCommand);

        return new Promise((resolve, reject) => {
            devtool.start(port);
        });
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
