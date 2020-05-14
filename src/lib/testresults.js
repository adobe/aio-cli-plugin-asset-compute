/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

'use strict';

const fse = require('fs-extra');
const XML = require('xml');
const fastCsv = require('fast-csv');
const path = require('path');
const util = require("./util");

class TestResults {
    constructor(name) {
        this.name = name;
        this.passes = 0;
        this.skipped = 0;
        this.failures = 0;
        this.errors = 0;
        this.expectedErrors = 0;
        this.tests = [];
    }

    addTestCase(name) {
        const testCaseResult = {
            name: name
        };
        this.tests.push(testCaseResult);
        return testCaseResult;
    }

    get current() {
        return this.tests[this.tests.length - 1];
    }

    get totalRun() {
        return this.passes + this.failures + this.errors + this.expectedErrors;
    }

    writeJunitXmlReport(filePath) {
        // create junit xml report
        // https://github.com/windyroad/JUnit-Schema/blob/master/JUnit.xsd
        // https://stackoverflow.com/questions/4922867
        const testCases = this.tests.map(testCase => {
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
                ];
            } else if (testCase.errorMsg) {
                testCaseXML = [
                    testCaseXML, {
                        error: {
                            _attr: {
                                message: testCase.errorMsg
                            }
                        }
                    }
                ];
            } else if (!testCase.time) {
                testCaseXML = [
                    testCaseXML, {
                        skipped: {}
                    }
                ];
            }
            return {
                testcase: testCaseXML
            };
        });
        const xml = XML({
            testsuite: [{
                _attr: {
                    name: this.name,
                    time: this.time.toFixed(2),
                    tests: this.tests.length,
                    failures: this.failures,
                    errors: this.errors,
                    skipped: this.skipped,
                    expectedErrors: this.expectedErrors
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

    writeCsvTimingReport(filePath) {
        const csv = fastCsv.format({ headers: true });
        csv.pipe(fse.createWriteStream(filePath));
        let totalProc = 0;
        this.tests.forEach(testCase => {
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
        if (this.time) {
            csv.write({
                name: "total",
                "processing time": totalProc.toFixed(3),
                "test time": this.time.toFixed(3)
            });
        }
        csv.end();
    }
}

module.exports = TestResults;
