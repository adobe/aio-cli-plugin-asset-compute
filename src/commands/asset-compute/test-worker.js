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

const debug = require('debug')('aio-asset-compute.test-worker');
const { flags } = require('@oclif/command');
const BaseCommand = require('../../base-command');
const WorkerTestRunner = require("../../lib/testrunner");
const util = require('../../lib/util');
const path = require("path");
const fs = require("fs");

// Old test directory path for previous AIO project struct (aio-cli v7 and below)
const TEST_DIR = path.join("test", "asset-compute");

class TestWorkerCommand extends BaseCommand {

    async run() {
        this.onProcessExit(async () => {
            if (this.testRunner) {
                await this.testRunner.stop();
            }
        });

        const argv = this.parse(TestWorkerCommand);

        try {
            if (argv.flags.action) {
                // test only selected worker

                const action = argv.flags.action;

                const testDir = path.join(this.testDir, action);
                if (!fs.existsSync(testDir)) {
                    throw new Error(`No tests found for action ${action}, missing directory: ${testDir}`);
                }

                await this.testWorker(action, testDir, argv);

            } else {
                // test all workers
                const actions = this.getActionsWithTests();
                if (actions.length === 0) {
                    console.log("No worker tests found in 'test/asset-compute/*'");
                    return;
                }

                console.log("Actions:");
                for (const action of actions) {
                    console.log(`- ${action}`);
                }
                console.log();

                for (const action of actions) {
                    await this.testWorker(action, path.join(this.testDir, action), argv);

                    console.log();
                }
            }
        } catch (e) {
            console.error("\nError:", e.message);
            debug(e);
            process.exitCode = 3;
        }
    }

    getActionsWithTests() {
        // test/
        //   asset-compute/
        //     workerA/
        //     workerB/
        if (fs.existsSync(this.testDir)) {
            return fs.readdirSync(this.testDir, { withFileTypes: true })
                .filter(actionTestDir => actionTestDir.isDirectory())
                .map(actionTestDir => actionTestDir.name);
        }
        return [];
    }

    get testDir() {
        // Old test directory (tests in the root of the project)
        // test/
        //   asset-compute/
        //     workerA/
        //     workerB/

        // v8 of aio-cli changed test directory
        // tests can be anywhere in the project, for example:
        // src/
        //   dx-asset-compute-worker-1/
        //      test/
        //          asset-compute/
        //              workerA/
        //              workerB/
        if (!this._testDir) {
            if (this.aioConfig) {
                this._testDir = path.join(this.aioConfig.tests.unit, "asset-compute");
            } else {
                // Stay backwards compatible with older aio project structure (aio-cli v7 and below)
                this._testDir = TEST_DIR;
            }
        }
        return this._testDir;
    }

    async testWorker(actionName, testDir, argv) {
        const startTime = util.timerStart();

        util.log(`Running tests in ${testDir}`);

        const action = await this.openwhiskAction(actionName);

        this.testRunner = new WorkerTestRunner(testDir, action, {
            startTime: startTime,
            testCasePattern: argv.args.testCase,
            updateRenditions: argv.flags.updateRenditions,
            // build/
            //   test-worker/
            //     <action>/
            tempDirectory: this.getBuildDir("test-worker", actionName),
            // build/
            //   test-results/
            //     test-<action>/
            testResultDirectory: this.getBuildDir("test-results", `test-${actionName}`)
        });

        await this.testRunner.run();

        delete this.testRunner;
    }
}

TestWorkerCommand.description = 'Run tests from local project';

TestWorkerCommand.args = [    {
    name: 'testCase',
    required: false,
    description: 'Test case(s) to run. Supports glob patterns. If not set, runs all tests.'
}];

TestWorkerCommand.flags = {
    ...BaseCommand.flags,

    action: flags.string({
        char: 'a',
        description: 'Worker to test. Use action name from manifest. If not set, runs tests for all workers.'
    }),

    updateRenditions: flags.boolean({
        char: 'u',
        description: 'Replace expected renditions of failing test cases with the generated rendition.'
    })
};

TestWorkerCommand.aliases = [
    'asset-compute:tw'
];

module.exports = TestWorkerCommand;
