/**
 *  ADOBE CONFIDENTIAL
 *  __________________
 *
 *  Copyright 2020 Adobe Systems Incorporated
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

const util = require('../../lib/util');
const path = require('path');
const fse = require('fs-extra');
const serverless = require('../../lib/serverless');
const testfiles = require('../../lib/testfiles');

const BaseCommand = require('../../base-command');
const { flags } = require('@oclif/command');

function runWorker(argv) {
    let targetDir;
    let json;
    argv.args.rendition = util.yargsFilePathOption(argv.args.rendition);

    if (argv.flags.data) {
        // take complete json from --data if present
        json = util.JSON.parse(argv.flags.data);

        if (fse.existsSync(argv.args.rendition)) {
            if (!fse.lstatSync(argv.args.rendition).isDirectory()) {
                util.logError(`Option --data {json} requires to pass a directory, but does not contain a valid directory: ${argv.args.rendition}`);
                process.exit(1);
            }
        } else {
            fse.ensureDirSync(argv.args.rendition);
        }

        targetDir = argv.args.rendition;

        // ensure just filenames, no paths for all renditions
        if (json.renditions) {
            json.renditions.forEach(rendition => {
                if (rendition.name) {
                    rendition.name = path.basename(rendition.name);
                }
            });
        }

    } else {
        const rendition = util.yargsFilePathOption(argv.flags.paramFile) ? require(argv.flags.paramFile) : {};

        // build json with single rendition
        rendition.fmt = argv.flags.fmt || rendition.fmt || util.extension(argv.args.rendition);
        rendition.name = path.basename(argv.args.rendition);

        targetDir = path.dirname(argv.args.rendition);

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

        json = {
            renditions: [
                rendition
            ]
        };
    }

    const dirs = util.prepareInOutDir();

    testfiles.getFile(argv.args.file)
    .then(function(sourceFile) {

        json.source = path.basename(sourceFile);

        // copy input file
        const inFile = path.resolve(dirs.in, path.basename(sourceFile));
        fse.copyFileSync(sourceFile, inFile);
        // ensure file is readable
        fse.chmodSync(inFile, 0o644);

        serverless.invokeLocal({
            inDir: dirs.in,
            outDir: dirs.out,
            params: json,
            verbose: argv.flags.verbose,
            dockerArgs:  ` -e WORKER_TEST_MODE='true' `
        })
        .then(() => {
            if (json.renditions) {
                json.renditions.forEach(rendition => {
                    if (rendition.name) {
                        // copy rendition out of .nui/out if present
                        const filename = path.basename(rendition.name);
                        const outFile = path.resolve(dirs.out, filename);
                        const targetFile = path.resolve(targetDir, filename);
                        if (fse.existsSync(outFile)) {
                            fse.copyFileSync(outFile, targetFile);
                        } else {
                            util.logWarn(`no rendition named ${filename} found`);
                        }
                    }
                });
            }
        })
        .catch(e => {
            util.logError(e.message || e);
            process.exitCode = 2;
        })
        .finally(() => {
            util.cleanupInOutDir(dirs);
        });
    })
    .catch(e => {
        util.logError(e.message || e);
        process.exitCode = 3;
    });
}


class RunWorkerCommand extends BaseCommand {

    async run() {
        const argv = this.parse(RunWorkerCommand);
        try {
            argv.args.file = util.yargsExistingFileOption(argv.args.file);

            if(argv.args.file) {
                return runWorker(argv);
            }
            util.logError(`No such file : ${argv.args.file}`);
        } catch (e) {
            util.logError(e);
        }
    }
}

RunWorkerCommand.description = 'Run worker from local project using Docker';

RunWorkerCommand.args = [
    {
        name: 'file',
        required: true,
        description: 'Path to input file for worker'
    },
    {
        name: 'rendition',
        required: true,
        description: 'Path where to create output rendition.\nSingle file for single rendition, or directory to create multiple renditions, in which case the full parameter json including rendition names must be provided using --data.'
    },
];

RunWorkerCommand.flags = {
    ...BaseCommand.flags,
    fmt: flags.string(
        {
            char: 'f',
            description: 'Replace expected renditions of failing test cases with the generated rendition.'
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
            description: 'Path to parameter json file.'
        }
    ),
    data: flags.string(
        {
            char: 'd',
            description: 'Complete input parameters as JSON string. Allows multiple renditions.',
            exclusive: ['fmt', 'paramFile', 'param']
        }
    )
};

module.exports = RunWorkerCommand;