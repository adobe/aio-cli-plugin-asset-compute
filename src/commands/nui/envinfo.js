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

module.exports = EnvInfoCommand
