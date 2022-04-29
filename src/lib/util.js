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

const fse = require('fs-extra');
const path = require('path');
const rimraf = require('rimraf');
const { red, yellow } = require('chalk');
const util = require('util');
const Console = console.Console;

// for redirectOutputToLogFile()
let originalStdOut, originalStdErr, outFile;

function logError(...msg) {
    console.log(red("error:"), red(...msg));
}

function dirExistsAndEmpty(path) {
    return fse.existsSync(path) && fse.readdirSync(path).length === 0;
}

module.exports = {
    log: function (...msg) {
        console.log(...msg);
    },

    logWarn: function (...msg) {
        console.log(yellow("warning:"), yellow(...msg));
    },

    logError: logError,

    // create temporary hidden folder for in & out dirs to mount
    prepareInOutDir: function (buildDir) {
        const uniqueName = (process.env.BUILD_TAG || new Date().toISOString()).replace(/[^a-zA-Z0-9_]/g, '_');
        const dirs = {
            build:    buildDir,
            work:     path.resolve(buildDir, uniqueName),
            in:       path.resolve(buildDir, uniqueName, 'in'),
            out:      path.resolve(buildDir, uniqueName, 'out'),
            errors:   path.resolve(buildDir, uniqueName, 'out', 'errors'),
            failed:   path.resolve(buildDir, uniqueName, 'failed'),
            mock_crt: path.resolve(buildDir, uniqueName, 'mock-crt')
        };
        fse.ensureDirSync(dirs.in);
        // ensure readable by mounted docker container by giving everyone read
        fse.chmodSync(dirs.in, 0o755);
        fse.ensureDirSync(dirs.out);
        // ensure writeable by mounted docker container by giving everyone read+write
        fse.chmodSync(dirs.out, 0o777);
        // pre-create nested out/errors directory for reliable access to shellscript worker error.json and type.txt files
        fse.ensureDirSync(dirs.errors);
        fse.chmodSync(dirs.errors, 0o777);
        fse.ensureDirSync(dirs.failed);
        // ensure writeable by mounted docker container by giving everyone read+write
        fse.chmodSync(dirs.failed, 0o777);
        // mock certificate directory
        fse.ensureDirSync(dirs.mock_crt);
        // ensure readable by mounted docker container by giving everyone read
        fse.chmodSync(dirs.mock_crt, 0o755);
        return dirs;
    },

    // remove temporary in + out dirs and failed if empty
    cleanupInOutDir: function (dirs) {
        if (!dirs) {
            return;
        }
        fse.removeSync(dirs.in);
        if (dirExistsAndEmpty(dirs.errors)) {
            fse.removeSync(dirs.errors);
        }
        fse.removeSync(dirs.out);
        fse.removeSync(dirs.mock_crt);
        if (dirExistsAndEmpty(dirs.failed)) {
            fse.removeSync(dirs.failed);
        }
        if (dirExistsAndEmpty(dirs.work)) {
            fse.removeSync(dirs.work);
        }

        // remove build dir if empty and unused otherwise
        if (dirExistsAndEmpty(dirs.build)) {
            fse.removeSync(dirs.build);
        }
    },

    emptyInOutDir: function (dirs) {
        rimraf.sync(`${dirs.in}/*`);
        rimraf.sync(`${dirs.out}/*`);
    },

    extension: function (file) {
        return path.extname(file).split('.').pop();
    },

    timerStart: function () {
        return process.hrtime();
    },

    timerEnd: function (start) {
        const end = process.hrtime(start);
        const time = {
            seconds: end[0],
            nanoseconds: end[1],
        };
        return {
            seconds: time.seconds,
            nanoseconds: time.nanoseconds,
            toString: () => util.format('%ds %dms', time.seconds, Math.floor(time.nanoseconds / 1000000)),
            getSeconds: () => time.seconds + time.nanoseconds / 1000000000
        };
    },

    setLogFile: function (logFile) {
    // can't change the log file when piping to it
        if (!originalStdOut) {
            fse.ensureDirSync(path.dirname(logFile));
            // append to log file
            outFile = fse.createWriteStream(logFile, { flags: 'a' });
        }
    },

    redirectOutputToLogFile: function () {
        if (outFile && !originalStdOut) {
            originalStdOut = process.stdout.write;
            originalStdErr = process.stderr.write;
            process.stdout.write = process.stderr.write = outFile.write.bind(outFile);
        }
    },

    restoreOutput: function () {
        if (originalStdOut) {
            process.stdout.write = originalStdOut;
            process.stderr.write = originalStdErr;

            originalStdOut = undefined;
            originalStdErr = undefined;
        }
    },

    logToFile: function (...msg) {
        if (outFile) {
            const cons = new Console(outFile);
            if (msg.length === 0) {
                cons.log();
            } else {
                cons.log(...msg);
            }
        }
    }
};
