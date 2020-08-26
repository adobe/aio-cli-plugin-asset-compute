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

                const testDir = path.join(TEST_DIR, action);
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
                    await this.testWorker(action, path.join(TEST_DIR, action), argv);

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
        if (fs.existsSync(TEST_DIR)) {
            const tests = fs.readdirSync(TEST_DIR);
            // eslint-disable-next-line array-callback-return
            return tests.filter(test => {
                const testPath = path.resolve(TEST_DIR, test);
                try {
                    fs.readdirSync(testPath);
                    return test;
                // eslint-disable-next-line no-unused-vars
                } catch (e) {
                    console.error(`${testPath} is not a test case directory`);
                }
            });
        }
        return [];
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
