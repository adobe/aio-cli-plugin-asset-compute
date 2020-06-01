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

const { flags } = require('@oclif/command');
const BaseCommand = require('../../base-command');
const WorkerTestRunner = require("../../lib/testrunner");
const util = require('../../lib/util');

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
                await this.testWorker(argv.flags.action, argv);

            } else {
                // test all workers
                console.log("Actions:");
                for (const action of this.actionNames) {
                    console.log(`- ${action}`);
                }
                console.log();

                for (const action of this.actionNames) {
                    await this.testWorker(action, argv);

                    console.log();
                }
            }
        } catch (e) {
            console.error(e);
            process.exitCode = 3;
        }
    }

    async testWorker(actionName, argv) {
        const startTime = util.timerStart();

        const a = this.actions[actionName];
        if (!a) {
            throw new Error(`Action not found in manifest: ${actionName}`);
        }

        const dir = this.getActionSourceDir(actionName);
        if (!WorkerTestRunner.hasTests(dir)) {
            util.log(`No test cases found for ${actionName} in ${dir}`);
            return;
        }

        util.log(`Running tests for ${actionName} in ${dir}`);

        const action = await this.openwhiskAction(actionName);

        this.testRunner = new WorkerTestRunner(dir, action, {
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
