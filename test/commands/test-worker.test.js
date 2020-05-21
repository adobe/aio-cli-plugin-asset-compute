/*
 * Copyright 2020 Adobe. All rights reserved.
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

const { test } = require("@oclif/test");
const stdmock = require("stdout-stderr");
const assert = require("assert");
const path = require("path");
const { execSync } = require("child_process");
const fs = require("fs");
const glob = require("glob");
const rimraf = require("rimraf");

// tests are not running in a full oclif enviroment with the aio app plugin present,
// so we have to include it as a dev dependency and manually load and run the commands
// the code is invoking dynamically, by overwriting our BaseCommand.runCommand() helper
const COMMANDS = {
    "app:deploy": "@adobe/aio-cli-plugin-app/src/commands/app/deploy"
};
const BaseCommand = require("../../src/base-command");
BaseCommand.prototype.runCommand = async (command, argv) => {
    if (COMMANDS[command]) {
        await require(COMMANDS[command]).run(argv);
    } else {
        throw new Error(`Missing test implementation of aio command ${command}`);
    }
};

function assertExitCode(expectedCode) {
    assert.equal(process.exitCode, expectedCode, `unexpected exit code: ${process.exitCode}, expected: ${expectedCode}`);
}

describe("test-worker command", function() {

    const baseDir = process.cwd();

    function testWorker(dir, args=[]) {
        return test
            .stdout()
            .stderr()
            .do(() => {
                process.chdir(path.join(baseDir, dir));

                // make sure it builds a fresh action.zip
                rimraf.sync("dist");
                // remove temp directories
                rimraf.sync("build");
                rimraf.sync(".nui");

                // install dependencies for the project
                execSync("npm install");
            })
            // run the command to test
            .command(["asset-compute:test-worker", ...args])
            // npm install can take some time
            .timeout(30000)
            .finally(ctx => {
                // reset any exit code set by failing tests
                delete process.exitCode;

                // log stdout/stderr if test failed
                if (ctx.error) {
                    stdmock.stdout.stop();
                    stdmock.stderr.stop();
                    console.log(ctx.stdout);
                    console.error(ctx.stderr);
                }
            });
    }

    // TODO assert docker containers gone (all tests)
    // TODO multi worker project - run all, run one action tests only
    /*
        tests/
            commands/
                test-worker.test.js

            projects/
                example-worker-1/
                exmaple-worker-2/

    */

    describe("success", function() {

        testWorker("test-projects/worker-test-success")
            .it("runs successful tests", ctx => {
                assertExitCode(undefined);
                assert(ctx.stdout.includes(" - simple"));
                assert(ctx.stdout.includes("✔  Succeeded."));
                assert(ctx.stdout.includes("✔︎ All tests were successful."));
                assert(ctx.stdout.includes("- Tests run      : 1"));
                assert(ctx.stdout.includes("- Failures       : 0"));
                assert(ctx.stdout.includes("- Errors         : 0"));
                assert(!fs.existsSync(".nui"));
            });
    });

    describe("failure", function() {

        testWorker("test-projects/worker-test-failure-rendition")
            .it("fails with exit code 1 if test fails due to a different rendition result", ctx => {
                assertExitCode(1);
                assert(ctx.stdout.includes(" - fails"));
                assert(ctx.stdout.includes("✖  Failure: Rendition 'rendition0.jpg' not as expected. Validate exit code was: 2. Check build/test.log."));
                assert(ctx.stdout.includes("error: There were test failures."));
                assert(ctx.stdout.includes("- Tests run      : 1"));
                assert(ctx.stdout.includes("- Failures       : 1"));
                assert(ctx.stdout.includes("- Errors         : 0"));
                assert(glob.sync(".nui/*/failed/fails/rendition0.jpg").length, 1);
            });

        testWorker("test-projects/worker-test-failure-missing-rendition")
            .it("fails with exit code 1 if test fails due to a missing rendition", ctx => {
                assertExitCode(1);
                assert(ctx.stdout.includes(" - fails"));
                assert(ctx.stdout.includes("✖  Failure: No rendition generated. Check build/test.log."));
                assert(ctx.stdout.includes("error: There were test failures."));
                assert(ctx.stdout.includes("- Tests run      : 1"));
                assert(ctx.stdout.includes("- Failures       : 1"));
                assert(ctx.stdout.includes("- Errors         : 0"));
            });

        testWorker("test-projects/worker-invocation-error", [], true)
            .it("fails with exit code 2 if the worker invocation errors", () => {
                assertExitCode(2);
            });

        testWorker("test-projects/worker-build-error")
            .it("fails with exit code 3 if the worker does not build (has no manifest)", ctx => {
                assertExitCode(3);
                assert(ctx.stderr.match(/error.*manifest.yml/i));
            });

    });
});