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

const getCloudFile = require("../../src/lib/cloudfiles");

const { testCommand, assertExitCode, assertOccurrences, assertMissingOrEmptyDirectory } = require("./testutil");
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const glob = require("glob");
const rimraf = require("rimraf");
const nock = require("nock");

function assertTestResults(action) {
    assert(fs.existsSync(path.join("build", "test-results", `test-${action}`, "test.log")));
    assert(fs.existsSync(path.join("build", "test-results", `test-${action}`, "test-results.xml")));
    assert(fs.existsSync(path.join("build", "test-results", `test-${action}`, "test-timing-results.csv")));
}

// TODO test ctrl+c (might need a child process)
// TODO test argument -u

describe("test-worker command", function() {

    describe("success", function() {

        testCommand("test-projects/multiple-workers", "asset-compute:test-worker")
            .it("runs tests for all workers", function(ctx) {
                assertExitCode(undefined);
                assert(ctx.stdout.includes("Actions:\n- workerA\n- workerB"));
                assert(ctx.stdout.includes(" - testA"));
                assert(ctx.stdout.includes(" - testB"));
                assertOccurrences(ctx.stdout, "✔  Succeeded.", 2);
                assertOccurrences(ctx.stdout, "✔  Succeeded.", 2);
                assertOccurrences(ctx.stdout, "✔︎ All tests were successful.", 2);
                assertOccurrences(ctx.stdout, "- Tests run      : 1", 2);
                assertOccurrences(ctx.stdout, "- Failures       : 0", 2);
                assertOccurrences(ctx.stdout, "- Errors         : 0", 2);

                // legacy build folder, ensure it does not come back
                assert(!fs.existsSync(".nui"));
                // build directory must be in root
                assert(!fs.existsSync(path.join("actions", "workerA", "build")));
                assert(!fs.existsSync(path.join("actions", "workerB", "build")));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("workerA");
                assertTestResults("workerB");
            });

        testCommand("test-projects/multiple-workers", "asset-compute:test-worker", ["-a", "workerA"])
            .it("runs tests for the selected worker if -a is set", function(ctx) {
                assertExitCode(undefined);
                assert(!ctx.stdout.includes("workerB"));
                assert(ctx.stdout.includes(" - testA"));
                assert(!ctx.stdout.includes(" - testB"));
                assertOccurrences(ctx.stdout, "✔  Succeeded.", 1);
                assertOccurrences(ctx.stdout, "✔︎ All tests were successful.", 1);
                assertOccurrences(ctx.stdout, "- Tests run      : 1", 1);
                assertOccurrences(ctx.stdout, "- Failures       : 0", 1);
                assertOccurrences(ctx.stdout, "- Errors         : 0", 1);

                assert(!fs.existsSync(".nui"));
                assert(!fs.existsSync(path.join("actions", "workerA", "build")));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("workerA");
            });

        testCommand("test-projects/single-worker", "asset-compute:test-worker")
            .it("runs tests for a single worker at the root", function(ctx) {
                assertExitCode(undefined);
                assert(ctx.stdout.includes(" - simple"));
                assert(ctx.stdout.includes("✔  Succeeded."));
                assert(ctx.stdout.includes("✔︎ All tests were successful."));
                assert(ctx.stdout.includes("- Tests run      : 1"));
                assert(ctx.stdout.includes("- Failures       : 0"));
                assert(ctx.stdout.includes("- Errors         : 0"));

                assert(!fs.existsSync(".nui"));
                assert(!fs.existsSync(path.join("actions", "worker", "build")));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("worker");
            });

        testCommand("test-projects/mockserver", "asset-compute:test-worker")
            .it("runs successful tests with a mocked domain", function(ctx) {
                assertExitCode(undefined);
                assert(ctx.stdout.includes(" - mock"));
                assert(ctx.stdout.includes("✔  Succeeded."));
                assert(ctx.stdout.includes("✔︎ All tests were successful."));
                assert(ctx.stdout.includes("- Tests run      : 1"));
                assert(ctx.stdout.includes("- Failures       : 0"));
                assert(ctx.stdout.includes("- Errors         : 0"));

                assert(!fs.existsSync(".nui"));
                assert(!fs.existsSync(path.join("actions", "worker", "build")));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("worker");
            });

        testCommand("test-projects/cloudfiles", "asset-compute:test-worker")
            .prepare(() => {
                process.env.AWS_ACCESS_KEY_ID = "key";
                process.env.AWS_SECRET_ACCESS_KEY = "secret";
                // ensure the cloudfiles cache is deleted
                rimraf.sync(path.join(getCloudFile.GLOBAL_CACHE_DIR, "s3.amazonaws.com", "asset-compute-cli-test-bucket"));
                nock("https://s3.amazonaws.com").get("/asset-compute-cli-test-bucket/source").reply(200, "correct file");
                nock("https://s3.amazonaws.com").get("/asset-compute-cli-test-bucket/rendition").reply(200, "correct file");
            })
            .it("runs successful tests with cloud files", function(ctx) {
                assertExitCode(undefined);
                assert(ctx.stdout.includes(" - cloudfile"));
                assert(ctx.stdout.includes("✔  Succeeded."));
                assert(ctx.stdout.includes("✔︎ All tests were successful."));
                assert(ctx.stdout.includes("- Tests run      : 1"));
                assert(ctx.stdout.includes("- Failures       : 0"));
                assert(ctx.stdout.includes("- Errors         : 0"));

                assert(fs.existsSync(path.join(getCloudFile.GLOBAL_CACHE_DIR, "s3.amazonaws.com", "asset-compute-cli-test-bucket", "rendition")));
                assert(fs.existsSync(path.join(getCloudFile.GLOBAL_CACHE_DIR, "s3.amazonaws.com", "asset-compute-cli-test-bucket", "source")));

                assert(!fs.existsSync(".nui"));
                assert(!fs.existsSync(path.join("actions", "worker", "build")));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("worker");
            });
    });

    describe("failure", function() {

        testCommand("test-projects/test-failure-rendition", "asset-compute:test-worker")
            .it("fails with exit code 1 if test fails due to a different rendition result", function(ctx) {
                assertExitCode(1);
                assert(ctx.stdout.includes(" - fails"));
                assert(ctx.stdout.includes("✖  Failure: Rendition 'rendition0.jpg' not as expected. Validate exit code was: 2. Check build/test-results/test-worker/test.log."));
                assert(ctx.stdout.includes("error: There were test failures."));
                assert(ctx.stdout.includes("- Tests run      : 1"));
                assert(ctx.stdout.includes("- Failures       : 1"));
                assert(ctx.stdout.includes("- Errors         : 0"));
                assert(glob.sync("build/test-worker/**/failed/fails/rendition0.jpg").length, 1);
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("worker");
            });

        testCommand("test-projects/test-failure-missing-rendition", "asset-compute:test-worker")
            .it("fails with exit code 1 if test fails due to a missing rendition", function(ctx) {
                assertExitCode(1);
                assert(ctx.stdout.includes(" - fails"));
                assert(ctx.stdout.includes("✖  Failure: No rendition generated. Check build/test-results/test-worker/test.log."));
                assert(ctx.stdout.includes("error: There were test failures."));
                assert(ctx.stdout.includes("- Tests run      : 1"));
                assert(ctx.stdout.includes("- Failures       : 1"));
                assert(ctx.stdout.includes("- Errors         : 0"));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("worker");
            });

        testCommand("test-projects/invocation-error", "asset-compute:test-worker")
            .it("fails with exit code 2 if the worker invocation errors", function() {
                assertExitCode(2);
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertTestResults("worker");
            });

        testCommand("test-projects/build-error", "asset-compute:test-worker")
            .it("fails with exit code 3 if the worker does not build (has no manifest)", function(ctx) {
                assertExitCode(3);
                assert(ctx.stderr.match(/error.*manifest.yml/i));
                assertMissingOrEmptyDirectory("build", "test-worker");
                assertMissingOrEmptyDirectory("build", "test-results");
            });

    });
});