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

const debug = require('debug')('aio-asset-compute.run-worker');
const path = require('path');
const fse = require('fs-extra');
const AssetComputeWorkerRunner = require("../../lib/workerrunner");
const getCloudFile = require('../../lib/cloudfiles');
const util = require('../../lib/util');

const BaseCommand = require('../../base-command');
const { flags } = require('@oclif/command');

class RunWorkerCommand extends BaseCommand {

    async run() {
        this.onProcessExit(async () => {
            if (this.workerRunner) {
                this.workerRunner.stop();
            }
        });

        const argv = this.parse(RunWorkerCommand);

        try {
            const actionName = await this.selectAction(argv);

            return await this.runWorker(actionName, argv);

        } catch (e) {
            console.error("Error:", e.message);
            debug(e);
            process.exitCode = 1;
        }
    }

    async selectAction(argv) {
        if (this.actionNames.length === 0) {
            throw new Error("No action found in manifest.yml");
        }

        let name;
        if (argv.flags.action) {
            name = argv.flags.action;
        } else if (this.actionNames.length === 1) {
            name = this.actionNames[0];
        } else {
            throw new Error("Must specify worker to run using --action");
        }

        return name;
    }

    getParams(argv) {
        let params;
        let targetDir;

        if (argv.flags.data) {
            // take complete json from --data if present
            params = JSON.parse(argv.flags.data);

            // must point to a dir if --data is set
            targetDir = argv.args.rendition;

            if (fse.existsSync(targetDir)) {
                if (!fse.lstatSync(targetDir).isDirectory()) {
                    util.logError(`Option --data {json} requires to pass a directory, but does not contain a valid directory: ${argv.args.rendition}`);
                    process.exit(1);
                }
            } else {
                fse.ensureDirSync(targetDir);
            }

            // ensure just filenames, no paths for all renditions
            if (params.renditions) {
                params.renditions.forEach(rendition => {
                    if (rendition.name) {
                        rendition.name = path.basename(rendition.name);
                    }
                });
            }

        } else {
            const rendition = argv.flags.paramFile ? require(argv.flags.paramFile) : {};

            const renditionFile = argv.args.rendition;

            // build json with single rendition
            rendition.name = path.basename(renditionFile);

            targetDir = path.dirname(renditionFile);

            // set params if available
            if (argv.flags.param) {
                if(argv.flags.param.length % 2 !== 0) {
                    util.logError('Values were provided for the option --param, but were not specified as <key> <value>.\nPlease make sure the --param input is correct.');
                    process.exit(1);
                }
                for (let i = 0; i < argv.flags.param.length-1; i+=2) {
                    const key = argv.flags.param[i];
                    const value = argv.flags.param[i+1];
                    rendition[key] = value;
                }
            }

            params = {
                renditions: [
                    rendition
                ]
            };
        }

        return { params: params, targetDir };
    }

    async runWorker(actionName, argv) {
        const { params, targetDir } = this.getParams(argv);

        const action = await this.openwhiskAction(actionName);

        const sourceFile = await getCloudFile(argv.args.file);
        params.source = path.basename(sourceFile);

        params.requestId = `run-worker in ${path.basename(process.cwd())}`;

        // build/
        //   run-worker/
        //     <action>/
        const dirs = util.prepareInOutDir(this.getBuildDir("run-worker", actionName));

        // copy input file
        const inFile = path.resolve(dirs.in, params.source);
        fse.copyFileSync(sourceFile, inFile);
        // ensure file is readable
        fse.chmodSync(inFile, 0o644);

        this.workerRunner = new AssetComputeWorkerRunner({
            action: action,
            containerName: `aio-asset-compute-runworker-${action.name}-${new Date().toISOString()}`,
            sourceDir: dirs.in,
            targetDir: dirs.out
        });

        try {
            await this.workerRunner.start();

            const result = await this.workerRunner.run(params);

            if (result.renditions) {
                for (let idx = 0; idx < result.renditions.length; idx++) {
                    const rendition = result.renditions[idx];

                    const filename = rendition.name ? path.basename(rendition.name) : `rendition${idx}`;

                    // copy rendition if present
                    const outFile = path.resolve(dirs.out, filename);
                    const targetFile = path.resolve(targetDir, filename);
                    if (fse.existsSync(outFile)) {
                        debug("created rendition:", targetFile);
                        fse.copyFileSync(outFile, targetFile);
                    } else {
                        util.logWarn(`no rendition named ${filename} found`);
                    }
                }
            }

        } finally {
            await this.workerRunner.stop();

            util.cleanupInOutDir(dirs);
        }
    }
}

RunWorkerCommand.description = 'Run worker from local project using Docker';

RunWorkerCommand.args = [
    {
        name: 'file',
        required: true,
        parse: p => path.resolve(p),
        description: 'Path to input file for worker'
    },
    {
        name: 'rendition',
        required: true,
        parse: p => path.resolve(p),
        description: 'Path where to create output rendition.\nSingle file for single rendition, or directory to create multiple renditions, in which case the full parameter json including rendition names must be provided using --data.'
    },
];

RunWorkerCommand.flags = {
    ...BaseCommand.flags,
    action: flags.string(
        {
            char: 'a',
            description: 'Worker to run. Use action name from manifest. Not required if there is only one.'
        }
    ),
    param: flags.string(
        {
            char: 'p',
            description: '<key> <value> - Set parameters for rendition, can be used multiple times',
            multiple: true
        }
    ),
    paramFile: flags.string(
        {
            char: 'P',
            parse: p => path.resolve(p),
            description: 'Path to parameter json file.'
        }
    ),
    data: flags.string(
        {
            char: 'd',
            description: 'Complete input parameters as JSON string. Allows multiple renditions.',
            exclusive: ['paramFile', 'param']
        }
    )
};

module.exports = RunWorkerCommand;
