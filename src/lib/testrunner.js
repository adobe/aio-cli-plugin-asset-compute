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

const debug = require('debug')('aio-asset-compute.test-runner');
const fse = require('fs-extra');
const path = require('path');
const glob = require('glob');
const minimatch = require('minimatch');
const { red, green, yellow } = require('chalk');
const { execSync } = require('child_process');

const AssetComputeWorkerRunner = require("./workerrunner");
const MockServer = require('./mockserver');
const getCloudFile = require('./cloudfiles');
const TestResults = require("./testresults");
const util = require("./util");

// constants
const TEST_FOLDER = 'tests';
const BUILD_DIR = 'build';
const LOG_FILE = path.join(BUILD_DIR, 'test.log');
const RESULT_FILE = path.resolve(BUILD_DIR, 'test-results.xml');
const TIMING_RESULT_FILE = path.resolve(BUILD_DIR, 'test-timing-results.csv');

function globFile(dir, pattern, description) {
    const files = glob.sync(`${dir}/${pattern}`);
    if (files.length === 0) {
        return null;
    }
    if (files.length > 1) {
        util.logWarn(`multiple ${description} files found in '${path.basename(process.cwd())}', only using the first one: ${files}`);
    }

    return files[0];
}

async function globCloudFile(dir, pattern, description) {
    const file = globFile(dir, pattern, description);
    return getCloudFile(file);
}

function getTestsDirectory(baseDir) {
    const testDir = path.resolve(baseDir, TEST_FOLDER);
    if (fse.existsSync(testDir) && fse.lstatSync(testDir).isDirectory()) {
        return testDir;
    }
}

/**
 * Runs Asset Compute worker SDK unit tests, which run special source -> rendition tests.
 * These must be placed in a subfolder "tests/" next to the action.
 */
class WorkerTestRunner {

    static hasTests(baseDir) {
        return getTestsDirectory(baseDir);
    }

    constructor(dir, action, options={}) {
        this.baseDir = path.resolve(dir);
        this.action = action;
        this.options = options;
        this.timers = {
            start: options.startTime || util.timerStart()
        };
        this.testDir = getTestsDirectory(this.baseDir);
    }

    async run() {
        // --------------------------------------------------------------------------------------
        // overview

        // 1. create temp folder with in & out
        // 2. start container with in & out mounted
        // 3. for each test case
        //   - 4. copy contents of individual test dir to in
        //   - 5. run test
        //   - 6. check result from out
        //   - 7. clean out in & out
        // 8. stop container

        // --------------------------------------------------------------------------------------

        if (!this.testDir) {
            return;
        }

        try {
            await this._prepare();

            await this._runAllTests();

            await this._reportResults();

        } finally {
            await this._cleanup();
        }
    }

    async stop() {
        this.running = false;
        await this._cleanup();
    }

    // -------------------------------< internal >--------------------------

    async _prepare() {
        this.testLogFile = path.resolve(this.baseDir, LOG_FILE);
        fse.removeSync(this.testLogFile);
        util.setLogFile(this.testLogFile);

        util.logToFile(`${new Date().toISOString()} Running tests for ${this.action.name} in ${this.testDir}`);

        // get a unique container name for concurrent jobs on Jenkins,
        // using the Jenkins BUILD_TAG env var if available, or the current
        const uniqueId = process.env.CIRCLE_WORKFLOW_JOB_ID || process.env.BUILD_TAG || new Date().toISOString();
        const projectName = path.basename(this.baseDir);
        const containerNameHint = `asset-compute-testworker-${projectName}-${uniqueId}`;

        this.testResults = new TestResults(`Worker unit tests for ${this.action.name}`);

        // 1. create temp folder with in & out

        // requirements:
        // - we need to ensure the container can't delete our test source files, and at least
        //    with Docker for Mac it's not possible to limit the write access of the container.
        // - we run multiple tests with different files, but want to reuse the same container.
        //
        // hence we create temporary directories for "in" and "out" on the host, mount them into
        // the container (as /in and /out), and copy the test file(s) into the temporary dirs
        // for each test case, and also clean them out after each test case.
        this.dirs = util.prepareInOutDir();

        const runnerOptions = {
            action: this.action,
            containerName: containerNameHint,
            sourceDir: this.dirs.in,
            targetDir: this.dirs.out,
            mounts: {},
            env: {}
        };

        // go through test cases to see if there are any cases that use mocks
        this.hasMocks = glob.sync(`${TEST_FOLDER}/**/mock-*.json`).length > 0;
        if (this.hasMocks) {
            // pass CA certificate to action container so it can connect to mock containers via https
            fse.copySync(`${__dirname}/mock-crt`, this.dirs.mock_crt);
            runnerOptions.mounts[this.dirs.mock_crt] = "/mock-crt";
            runnerOptions.env.NODE_EXTRA_CA_CERTS = "/mock-crt/CertificateAuthorityCertificate.pem";
        }

        this.workerRunner = new AssetComputeWorkerRunner(runnerOptions);

        // 2. start container
        await this.workerRunner.start();
    }

    async _runAllTests() {
        this.running = true;
        this.timers.testCases = util.timerStart();

        util.log('Test cases:');
        util.log();

        // 3. go through all test cases
        for (const testCase of fse.readdirSync(this.testDir)) {
            if (!this.running) {
                return;
            }

            if (!this._shouldRunTest(testCase)) {
                continue;
            }
            const dir = path.resolve(this.testDir, testCase);

            // only look at directories
            if (fse.lstatSync(dir).isDirectory()) {
                await this._runTest(testCase, dir);
            }
        }
    }

    _shouldRunTest(testCase) {
        if (this.options.testCasePattern) {
            const match = minimatch(testCase, this.options.testCasePattern);
            if (!match) {
                debug(`skipping test case '${testCase}' as it does not match pattern '${this.options.testCasePattern}`);
            }
            return match;

        } else {
            return true;
        }
    }

    async _runTest(testCase, dir) {
        this.timers.currentTest = util.timerStart();

        util.log(" -", testCase);

        this.testResults.addTestCase(testCase);

        const { source, renditionParams, expectedRendition, expectedErrorReason } = await this._readTestFiles(dir);
        if (!source) {
            this._logSkip("no test input file found");
            return;
        }
        if (expectedErrorReason && expectedRendition) {
            this._logError(`Invalid test case '${testCase}': expects an error ('errorReason' in params.json) and a rendition (${path.relative(dir, expectedRendition)})`);
            return;
        }

        util.logToFile(`${new Date().toISOString()} Running test case: ${testCase} from ${dir}`);

        // TODO: get rid of this HACK by connecting docker logs right into the test file
        // redirect stdout + stderr to test.log during the test execution
        util.redirectOutputToLogFile();

        // start mock containers if defined
        await this._startMocks(dir);

        try {
            // 4. copy contents of directory
            this._copySource(dir, source);

            // 5. run worker test
            const params = {
                source: path.basename(source),
                renditions: [
                    renditionParams
                ],
                requestId: `Test: ${testCase} -----------------------------------------------`
            };

            const result = await this._runWorker(params);

            // 6. validate results
            await this._validateResult(testCase, dir, result, expectedRendition, expectedErrorReason);

        } catch (e) {
            this._validateErrorResult(e);

        } finally {
            // 7. clean out in & out
            util.emptyInOutDir(this.dirs);

            await this._stopMocks();
        }
    }

    async _startMocks(dir) {
        await this._stopMocks();
        this.mocks = [];

        const mockFiles = glob.sync(dir + "/mock-*.json");
        for (const mockFile of mockFiles) {
            debug(`starting mock for ${mockFile}`);

            const mockServer = new MockServer(mockFile, this.workerRunner.getContainerName());
            this.mocks.push(mockServer);

            await mockServer.start();
        }
    }

    async _stopMocks() {
        if (this.mocks) {
            for (const mockServer of this.mocks) {
                debug(`stopping mock for ${mockServer.mockFile}`);

                await mockServer.stop();
            }

            delete this.mocks;
        }
    }

    async _readTestFiles(dir) {
        const source = await globCloudFile(dir, "file**", "test input");
        if (!source) {
            return;
        }

        const paramsFile = globFile(dir, "params.json", "parameters");
        const renditionParams = fse.existsSync(paramsFile) ? require(paramsFile) : {};

        const expectedErrorReason = renditionParams.errorReason;
        // don't propagate this field into the action invocation
        delete renditionParams.errorReason;

        const expectedRendition = await globCloudFile(dir, "rendition.**", "expected rendition");

        // determine fmt from rendition file extension if not specified
        if (!renditionParams.fmt && expectedRendition) {
            renditionParams.fmt = util.extension(expectedRendition);
        }

        return { source, renditionParams, expectedRendition, expectedErrorReason };
    }

    async _runWorker(params) {
        const procStart = util.timerStart();

        const result = await this.workerRunner.run(params);

        this._currentResult().procTime = util.timerEnd(procStart).getSeconds();

        return result;
    }

    _copySource(dir, source) {
        // copy all files in case of workers reading more than "source"
        fse.copySync(dir, this.dirs.in, { dereference: true });

        // ensure source file is readable for non-root users (might be the case on CI docker images)
        const inFile = path.resolve(this.dirs.in, path.basename(source));
        fse.chmodSync(inFile, 0o644);
    }

    async _validateResult(testCase, dir, result, expectedRendition, expectedErrorReason) {
        this._logBeginValidation();

        if (expectedRendition) {
            const validationFailureMsg = await this._validateRendition(testCase, dir, expectedRendition);

            // include validation/diff script in this time
            this._logEndValidation();

            if (validationFailureMsg) {
                this._logFailure(validationFailureMsg);

            } else {
                this._logSuccess();
            }

        } else {
            // no expected rendition, look for an expected error
            const renditionError = this._getRenditionError(result);
            if (renditionError) {
                util.logToFile("Rendition error:", renditionError);

            } else {
                util.logToFile("Expected error, but no rendition error in result:", result);
            }

            this._logEndValidation();

            // if rendition failed in the worker...
            if (renditionError) {
                // ... check if expected
                if (renditionError.reason === expectedErrorReason || renditionError.name === expectedErrorReason) {
                    this._logExpectedError();

                } else {
                    this._logFailure(`Expected error '${expectedErrorReason}' but got '${renditionError.reason}'`);
                }

            } else if (expectedErrorReason) {
                this._logFailure(`Expected error '${expectedErrorReason}' but none occurred`);

            } else {
                this._logError(`Missing expected rendition and no expected 'errorReason' in params.json`);
            }
        }
    }

    async _validateErrorResult(error, expectedRendition, expectedErrorReason) {

        this._logEndValidation();

        const errorMsg = error.message || error;

        if (expectedErrorReason) {
            if (errorMsg === expectedErrorReason) {
                // good, error messgae as expected
                this._logExpectedError();

            } else {
                // expected error, but got a different message
                this._logError(`Expected error '${expectedErrorReason}' but got '${errorMsg}'`);
            }
        } else {
            // errored
            this._logError(`${errorMsg}`);
        }
    }

    _getRenditionError(result) {
        if (result && Array.isArray(result.renditionErrors) && result.renditionErrors.length >= 1) {
            return result.renditionErrors[0];
        }
    }

    _logBeginValidation() {
        util.logToFile('--------------------------------------------------------------------------------');
    }

    _logEndValidation() {
        // stop logging to test.log, restore stdout + stderr
        util.restoreOutput();
        util.logToFile('================================================================================');
    }

    _currentResult() {
        return this.testResults.current;
    }

    _logSkip(message) {
        this.testResults.skipped++;

        console.log(yellow(`      o Skipping: ${message}`));
    }

    _logSuccess() {
        const time = util.timerEnd(this.timers.currentTest);

        this._currentResult().time = time.getSeconds();
        this.testResults.passes++;

        console.log(green(`      ✔  Succeeded.`), yellow(time.toString()));
    }

    _logExpectedError() {
        const time = util.timerEnd(this.timers.currentTest);

        this._currentResult().time = time.getSeconds();
        this.testResults.expectedErrors++;

        console.log(green(`      ✔  Succeeded (expected error).`), yellow(time.toString()));
    }

    _logFailure(message) {
        const time = util.timerEnd(this.timers.currentTest);

        this._currentResult().time = time.getSeconds();
        this._currentResult().failureMsg = message;
        this.testResults.failures++;

        console.log(red(`      ✖  Failure: ${message}. Check ${LOG_FILE}.`), yellow(time.toString()));
    }

    _logError(message) {
        const time = util.timerEnd(this.timers.currentTest);

        this._currentResult().time = time.getSeconds();
        this._currentResult().errorMsg = message;
        this.testResults.errors++;

        console.log(red(`      ✖  Error: ${message}. Check ${LOG_FILE}.`), yellow(time.toString()));
    }

    async _validateRendition(testCase, dir, expectedRendition) {
        const renditions = glob.sync(this.dirs.out + '/rendition**');
        const actualRendition = renditions.length >= 1 ? renditions[0] : "";

        if (!fse.existsSync(actualRendition)) {
            const failureMsg = actualRendition === "" ? `No rendition generated` : `Cannot find generated rendition '${path.basename(actualRendition)}'`;
            util.logToFile(`Validation failed: ${failureMsg}`);
            return failureMsg;

        } else {
            return this._validateRenditionIsCorrect(testCase, dir, actualRendition, expectedRendition);
        }
    }

    async _validateRenditionIsCorrect(testCase, dir, actualRendition, expectedRendition) {
        let failureMsg;

        try {
            // execute validation script
            const validate = globFile(dir, "validate", "validate script");
            if (validate) {
                const cmd = `${validate} ${expectedRendition} ${actualRendition}`;
                util.logToFile(`Running validation: ${cmd}`);
                execSync(`bash -x ${cmd}`);

            } else {
                const cmd = `diff ${expectedRendition} ${actualRendition}`;
                util.logToFile(`Running validation: ${cmd}`);
                execSync(cmd);
            }
            util.logToFile('Validation successful.');

        } catch (e) {
            // The rendition is not as expected so save it for later inspection
            const renditionFile = path.basename(actualRendition);
            fse.ensureDirSync(`${this.dirs.failed}/${testCase}`);
            fse.copySync(actualRendition, `${this.dirs.failed}/${testCase}/${renditionFile}`);

            failureMsg = `Rendition '${path.basename(actualRendition)}' not as expected. Validate exit code was: ${e.status}`;
            if (e.stdout) {
                util.logToFile(e.stdout.toString().trim());
            }
            if (e.stderr) {
                util.logToFile(e.stderr.toString().trim());
            }
            util.logToFile(`!!! Validation failed: ${failureMsg}`);

            if (this.options.updateRenditions) {
                console.log(`Updating exepected rendition ${expectedRendition}`);
                fse.copyFileSync(actualRendition, expectedRendition);
            }
        }

        return failureMsg;
    }

    async _cleanup() {
        if (this.workerRunner) {
            try {
                await this.workerRunner.stop();
            } catch (e) {
                util.logWarn('Problem while stopping worker container:', e.message || e);
            }
        }

        try {
            // these are run and stopped per test, but if we abort in the middle, we have to remove them as well
            await this._stopMocks();
        } catch (e) {
            util.logWarn('Problem while stopping mocks:', e.message || e);
        }

        if (this.dirs) {
            try {
                util.cleanupInOutDir(this.dirs);
            } catch (e) {
                util.logWarn('Problem while cleaning up temporary directories:', e.message || e);
            }
        }
    }

    async _reportResults() {
        const testCasesTime = util.timerEnd(this.timers.testCases);

        util.log();

        util.logToFile(`${new Date().toISOString()} Finished tests for ${this.action.name}.`);

        const results = this.testResults;

        const totalTime = util.timerEnd(this.timers.start);
        results.time = totalTime.getSeconds();

        const testResultFile = path.resolve(this.baseDir, RESULT_FILE);
        const timingResultFile = path.resolve(this.baseDir, TIMING_RESULT_FILE);

        results.writeJunitXmlReport(testResultFile);
        results.writeCsvTimingReport(timingResultFile);

        if (results.failures > 0 && results.errors > 0) {
            util.logError(red('There were test failures and errors.'));
        } else if (results.failures > 0) {
            util.logError(red('There were test failures.'));
        } else if (results.errors > 0) {
            util.logError(red('There were test errors.'));
        } else {
            util.log('✔︎ All tests were successful.');
        }

        console.log(`  - Tests run      : ${results.totalRun}`);
        if (results.failures > 0) {
            util.log(red(`  - Failures       : ${results.failures}`));
        } else {
            util.log('  - Failures       : 0');
        }
        if (results.errors > 0) {
            util.log(red(`  - Errors         : ${results.errors}`));
        } else {
            util.log('  - Errors         : 0');
        }
        if (results.skipped > 0) {
            util.log(yellow(`  - Skipped        : ${results.skipped}`));
        }
        if (results.expectedErrors > 0) {
            util.log(`  - Expected errors: ${results.expectedErrors}`);
        }

        util.log();
        util.log("Test time :", testCasesTime.toString());
        util.log("Total time:", totalTime.toString());

        util.log();
        util.log('Test results   :', testResultFile);
        util.log('Timing results :', timingResultFile);
        util.log('Test log       :', this.testLogFile);

        if (results.failures > 0 || results.errors > 0) {
            process.exitCode = 1;
        }
    }
}

module.exports = WorkerTestRunner;
