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
const envinfo = require('envinfo');

class EnvInfoCommand extends BaseCommand {
    async run() {
        return envinfo.run(
            {
                System: ['OS', 'CPU', 'Memory'],
                Binaries: ['Node', 'Yarn', 'npm'],
                Virtualization: ['Docker'],
                npmPackages: ['@nui/serverless-nui'],
            },
            { markdown: true, console: true, showNotFound: true }
        );
    }
}

EnvInfoCommand.description = 'Display dev environment version information';

module.exports = EnvInfoCommand;
