/**
 *  ADOBE CONFIDENTIAL
 *  __________________
 *
 *  Copyright 2018 Adobe Systems Incorporated
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

const serverless = require('../../lib/serverless');
const testfiles = require('../../lib/testfiles');
const util = require('../../lib/util');
const path = require('path');
const fse = require('fs-extra');
const glob = require('glob');
const { red, green, yellow } = require('chalk');
const XML = require('xml');
const { execSync } = require('child_process');
const fastCsv = require('fast-csv');

const TEST_FOLDER = 'tests';
const BUILD_DIR = 'build';
const LOG_FILE = path.resolve(BUILD_DIR, 'test.log');
const RESULT_FILE = path.resolve(BUILD_DIR, 'test-results.xml');
const TIMING_RESULT_FILE = path.resolve(BUILD_DIR, 'test-timing-results.csv');

function getFile(dir, pattern, description) {
    const files = glob.sync(dir + '/' + pattern);
    if (files.length === 0) {
         return Promise.resolve(null);
    }
    if (files.length > 1) {
        util.logWarn("multiple", description, "files found in `" + path.basename(process.cwd()) + "`, only using the first one:", files);
    }
    return testfiles.getFile(files[0]);
}

function writeTestResults(testResults, filePath) {
    // create junit xml report
    // https://stackoverflow.com/questions/4922867
    const testCases = testResults.tests.map(testCase => {
        let testCaseXML = {
            _attr: {
                name: testCase.name,
                time: testCase.time ? testCase.time.toFixed(2) : undefined
            },
        };
        if (testCase.failureMsg) {
            testCaseXML = [
                testCaseXML, {
                    failure: {
                        _attr: {
                            message: testCase.failureMsg
                        }
                    }
                }
            ]
        } else if (testCase.errorMsg) {
            testCaseXML = [
                testCaseXML, {
                    error: {
                        _attr: {
                            message: testCase.errorMsg
                        }
                    }
                }
            ]
        } else if (!testCase.time) {
            testCaseXML = [
                testCaseXML, {
                    skipped: {}
                }
            ]
        }
        return {
            testcase: testCaseXML
        }
    });
    const xml = XML({
        testsuite: [{
            _attr: {
                name: testResults.name,
                time: testResults.time.toFixed(2),
                tests: testResults.tests.length,
                failures: testResults.failures,
                errors: testResults.errors,
                skipped: testResults.skipped,
                expectedErrors: testResults.expectedErrors
            }
        }].concat(testCases)
    }, {
        declaration: true,
        indent: '  '
    });

    // write to file
    fse.ensureDirSync(path.dirname(filePath));
    try {
        fse.writeFileSync(filePath, xml, 'utf-8');
    } catch (e) {
        util.logError(`problem writing test results: ${e}`);
    }
}

function writeTimingResults(testResults, filePath) {
    const csv = fastCsv.createWriteStream({headers: true});
    csv.pipe(fse.createWriteStream(filePath));
    let totalProc = 0;
    testResults.tests.forEach(testCase => {
        if (!testCase.time) {
            csv.write({
                name: testCase.name
            });
        }
        else if (!testCase.procTime) {
            csv.write({
                name: testCase.name,
                "test time": testCase.time.toFixed(3)
            });
        }
        else {
            totalProc += testCase.procTime;
            csv.write({
                name: testCase.name,
                "processing time": testCase.procTime.toFixed(3),
                "test time": testCase.time.toFixed(3)
            });

        }
    });
    if (testResults.time){
        csv.write({
            name: "total",
            "processing time": totalProc.toFixed(3),
            "test time": testResults.time.toFixed(3)
        })
    }
    csv.end();
}

// runs the whole test suite
function testWorker(argv) {
    const start = util.timerStart();

    const baseDir = process.cwd();
    const testFolder = path.resolve(baseDir, TEST_FOLDER);
    if (!fse.existsSync(testFolder) || !fse.lstatSync(testFolder).isDirectory()) {
        util.log(`No test cases found (no folder '${TEST_FOLDER}').`);
        return;
    }

    const testResultFile = path.resolve(baseDir, argv.testResults || process.env.NUI_TEST_RESULTS || RESULT_FILE);
    const timingResultFile = path.resolve(baseDir, process.env.NUI_TEST_TIMING_RESULTS || TIMING_RESULT_FILE);
    const testLogFile = path.resolve(baseDir, LOG_FILE);
    fse.removeSync(testLogFile);
    util.setLogFile(testLogFile);

    const moduleName = util.packageJson().name;
    util.log(`Running tests for ${moduleName} in ${testFolder}`);
    util.logToFile(`${new Date().toISOString()} Running tests for ${moduleName} in ${testFolder}`);

    // get a unique container name for concurrent jobs on Jenkins,
    // using the Jenkins BUILD_TAG env var if available, or the current date
    const containerName = `${moduleName}_${process.env.BUILD_TAG || new Date().toISOString()}`;

    const testResults = {
        name: `Worker unit tests for ${moduleName}`,
        failures: 0,
        errors: 0,
        passes: 0,
        expectedErrors: 0,
        tests: []
    }

    // 1. we need to ensure the container can't delete our test source files, and at least
    //    with Docker for Mac it's not possible to limit the write access of the container.
    // 2. we run multiple tests with different files, but want to reuse the same container.
    //
    // hence we create temporary directories for "in" and "out" on the host, mount them into
    // the container (as /in and /out), and copy the test file(s) into the temporary dirs
    // for each test case, and also clean them out after each test case.

    // 1. create temp folder with in & out
    // 2. start container with in & out mounted
    // 3. for each test case
    //   - 4. copy contents of individual test dir to in
    //   - 5. run test
    //   - 6. check result from out
    //   - 7. clean out in & out
    // 8. stop container

    // 1. create temp folder with in & out
    const dirs = util.prepareInOutDir();
    // 2. start container
    let chain = serverless.invokeLocal({
        start: true,
        name: containerName,
        inDir: dirs.in,
        outDir: dirs.out,
        verbose: argv.verbose,
        dockerArgs:  ` -e WORKER_TEST_MODE='true' `
    }).catch(e => {
        util.log('');
        util.logError(e.message || e);
        process.exit(4);
    });

    let testCasesStart;
    chain = chain.then(() => {
        testCasesStart = util.timerStart();

        util.log('Test cases:');
        util.log();
    });

    // 3. go through all test cases
    fse.readdirSync(testFolder).forEach(testcase => {
        chain = chain.then(() => runTest(baseDir, testFolder, testcase, dirs, argv, testResults, containerName));
    });

    chain
    .catch(e => {
        util.logError(e.message || e);
        process.exitCode = 2;
    })
    .finally(() => {
        const testCasesTime = util.timerEnd(testCasesStart);
        process.chdir(baseDir);

        util.log();

        // 8. stop container
        serverless.invokeLocal({
            stop: true,
            name: containerName,
            verbose: argv.verbose
        })
        .catch(e => {
            util.logWarn('Problem while stopping container:', e.message || e);
            process.exitCode = 3;
        })
        .finally(() => {
            process.chdir(baseDir);

            util.cleanupInOutDir(dirs)

            util.logToFile(`${new Date().toISOString()} Finished tests for ${moduleName}.`);

            const totalTime = util.timerEnd(start);
            testResults.time = totalTime.getSeconds();
            testResults.skipped = testResults.tests.length - testResults.passes - testResults.failures - testResults.errors -testResults.expectedErrors;

            writeTestResults(testResults, testResultFile);
            writeTimingResults(testResults, timingResultFile);

            if (testResults.failures > 0 && testResults.errors > 0) {
                util.logError(red('There were test failures and errors.'));
            } else if (testResults.failures > 0) {
                util.logError(red('There were test failures.'));
            } else if (testResults.errors > 0) {
                util.logError(red('There were test errors.'));
            } else {
                util.log('✔︎ All tests were successful.')
            }

            util.log(        '  - Tests run      :', (testResults.passes + testResults.failures + testResults.errors + testResults.expectedErrors));
            if (testResults.failures > 0) {
                util.log(red(`  - Failures       : ${testResults.failures}`));
            } else {
                util.log(    '  - Failures       : 0');
            }
            if (testResults.errors > 0) {
                util.log(red(`  - Errors         : ${testResults.errors}`));
            } else {
                util.log(    '  - Errors         : 0');
            }
            if (testResults.skipped > 0) {
                util.log(yellow(`  - Skipped        : ${testResults.skipped}`));
            }
            if (testResults.expectedErrors > 0) {
               util.log(        `  - Expected errors: ${testResults.expectedErrors}`);
            }

            util.log();
            util.log("Test time :", testCasesTime.toString());
            util.log("Total time:", totalTime.toString());

            util.log();
            util.log('Test results   :', testResultFile);
            util.log('Timing results :', timingResultFile);
            util.log('Test log       :', testLogFile);

            if (testResults.failures > 0 || testResults.errors > 0) {
                process.exitCode = 1;
            }
        });
    });
}

// runs a single test case
function runTest(baseDir, testFolder, testcase, dirs, argv, testResults, containerName) {
    return new Promise(resolve => {
        const start = util.timerStart();

        const dir = path.resolve(testFolder, testcase);
        // only look at directories
        if (!fse.lstatSync(dir).isDirectory()) {
            return resolve();
        }

        util.log(" -", testcase);

        const testcaseResult = {
            name: testcase
        };
        testResults.tests.push(testcaseResult);

        // find test files & prepare worker invocation
        getFile(dir, "file**", "test input").then( (res) => {
            // console.log(res)
            const file = res;

            if (!file) {
                util.log(yellow('   o Skipping: no test input file found'));
                // util.logWarn(`no test input file found for testcase ${testcase}, skipping`);
                return resolve();
            }

            getFile(dir, "rendition.**", "expected rendition").then( (res) => {
                // console.log(typeof(res));
                const expectedRendition = res;
                getFile(dir, "validate", "validate script").then( (res) => {
                    const validate = res;

                    let params;
                    getFile(dir, "params.json", "parameters").then( (res) => {
                        const paramsFile = res;
                        if (fse.existsSync(paramsFile)) {
                            params = require(paramsFile);
                        } else {
                            params = {};
                        }

                        // If no expectedRendition we will expect no rendition either
                        // However, in that case we need to have the name and format
                        // in the params files because we can't get it from the
                        // expected rendition
                        if (!expectedRendition && !params.fmt) {
                            util.log(yellow('   o Skipping: no expected rendition file found and fmt not specified'));
                            return resolve();
                        }

                        if (!params.fmt) {
                            params.fmt = util.extension(expectedRendition);
                        }

                        const json = {
                            source: path.basename(file),
                            renditions: [
                                params
                            ]
                        };

                        util.logToFile(`${new Date().toISOString()} Running test case: ${testcase} from ${dir}`);
                        // redirect stdout + stderr to test.log during the test execution
                        util.redirectOutputToLogFile();

                        // 4. copy contents of directory
                        fse.readdirSync(dir).forEach(item => {
                            const srcFile = path.resolve(dir, item);
                            const inFile = path.resolve(dirs.in, item);
                            fse.copyFileSync(srcFile, inFile);
                            fse.chmodSync(inFile, 0o644);
                        });

                        // serverless changes the directory, go back to project dir every time
                        process.chdir(baseDir);

                        const procStart = util.timerStart();

                        // 5. run test, call serverless invoke local
                        serverless.invokeLocal({
                            name: containerName,
                            params: json,
                            verbose: argv.verbose,
                            dockerArgs:  `-e WORKER_TEST_MODE='true' `
                        })
                        .then(result => {
                            const procTime = util.timerEnd(procStart);
                            testcaseResult.procTime = procTime.getSeconds();

                            util.logToFile('--------------------------------------------------------------------------------');
                            // 6. validate results
                            // If we reach here and we didn't expect a rendition then that is an error
                            const renditions = glob.sync(dirs.out + '/rendition**');
                            const actualRendition = renditions.length >= 1 ? renditions[0] : "";

                            let failureMsg;
                            if (expectedRendition) {
                                if (!fse.existsSync(actualRendition)) {
                                    failureMsg = `No rendition '${path.basename(actualRendition)}' generated`;
                                    util.logToFile(`Validation failed: ${failureMsg}`);
                                } else {
                                    try {
                                        // execute validation script
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
                                        fse.ensureDirSync(`${dirs.failed}/${testcase}`);
                                        fse.copySync(actualRendition, `${dirs.failed}/${testcase}/${renditionFile}`);
                                        failureMsg = `Rendition '${path.basename(actualRendition)}' not as expected. Validate exit code was: ${e.status}`;
                                        if (e.stdout) {
                                            util.logToFile(e.stdout.toString().trim());
                                        }
                                        if (e.stderr) {
                                            util.logToFile(e.stderr.toString().trim());
                                        }
                                        util.logToFile(`!!! Validation failed: ${failureMsg}`);
                                        if (argv.updateRenditions) {
                                            console.log(`Updating exepected rendition ${expectedRendition}`);
                                            fse.copyFileSync(actualRendition, expectedRendition);
                                        }
                                    }
                                }
                            }

                            // 7. clean out in & out
                            util.emptyInOutDir(dirs);

                            // stop logging to test.log, restore stdout + stderr
                            util.restoreOutput();
                            util.logToFile('================================================================================');

                            const time = util.timerEnd(start);

                            if (!expectedRendition) {
                                if (result && Array.isArray(result.renditionErrors) && result.renditionErrors.length >= 1) {
                                    const reason = result.renditionErrors[0].reason;

                                    if (reason === params.errorReason) {
                                        console.log('      ' + green('✔  Expected error after ' + time.toString()));
                                        testResults.expectedErrors++;
                                    } else {
                                        failureMsg = 'Expected error ' + params.errorReason + ' but got ' + reason;
                                        console.log('      ' + red('✖  ' + failureMsg + ' after ' + time.toString() + '. Check ' + path.relative(baseDir, LOG_FILE)));
                                        testResults.errors++;
                                    }
                                } else {
                                    failureMsg = 'Expected error ' + params.errorReason + ', but none occurred';
                                    console.log('      ' + red('✖  ' + failureMsg + ' after ' + time.toString() + '. Check ' + path.relative(baseDir, LOG_FILE)));
                                    testResults.failures++;
                                }
                            } else if (failureMsg) {
                                console.log('      ' + red('✖  Failed in ' + time.toString() + '. ' + failureMsg + '. Check ' + path.relative(baseDir, LOG_FILE)));
                                testResults.failures++;
                            } else {
                                console.log('      ' + green('✔︎  Succeeded in ' + time.toString()));
                                testResults.passes++;
                            }

                            testcaseResult.time = time.getSeconds();
                            testcaseResult.failureMsg = failureMsg;

                            return resolve();
                        })
                        .catch(e => {
                            const errorMsg = e;
                            // 7. clean out in & out
                            util.emptyInOutDir(dirs);

                            // stop logging to test.log, restore stdout + stderr
                            util.restoreOutput();
                            util.logToFile('================================================================================');

                            const time = util.timerEnd(start);

                            if (expectedRendition) {
                                console.log('      ' + red('✖  Error after ' + time.toString() + '. ' + errorMsg + '. Check ' + path.relative(baseDir, LOG_FILE)));
                                testcaseResult.errorMsg = errorMsg;
                                testResults.errors++;
                            } else {
                                let reason;
                                try {
                                    const json = errorMsg.substring(errorMsg.indexOf('{'));
                                    const err = JSON.parse(json);
                                    reason = err.reason;
                                } catch (error) {
                                    reason = errorMsg;
                                }
                                if (reason === params.errorReason) {
                                    console.log('      ' + green('✔  Expected error after ' + time.toString()));
                                    testResults.expectedErrors++;
                                } else {
                                    console.log('      ' + red('✖  Expected error ' + params.errorReason +
                                    ' but got ' + reason + ' after ' + time.toString() + '. Check ' + path.relative(baseDir, LOG_FILE)));
                                    testResults.errors++;
                                }
                            }
                            testcaseResult.time = time.getSeconds();

                            return resolve();
                        });
                    });
                });
            });
        });
    });
}

class TestWorkerCommand extends BaseCommand {
    async run() {
        try {
            const { flags } = this.parse(TestWorkerCommand)
            return testWorker(flags);
        } catch (e) {
            console.error(e);
        }
    }
}

TestWorkerCommand.description = 'Run tests from local project';

TestWorkerCommand.flags = {
    updateRenditions: flags.boolean({
        char: 'u', 
        description: 'Replace expected renditions of failing test cases with the generated rendition.'
    }),
    ...BaseCommand.flags
}

TestWorkerCommand.aliases = [
    'nui:tw'
]

module.exports = TestWorkerCommand
