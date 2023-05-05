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

const { testCommand, assertExitCode, assertMissingOrEmptyDirectory } = require("./testutil");
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");

describe("run-worker command", function() {

    describe("success", function() {

        testCommand("test-projects/single-worker", "asset-compute:run-worker", ["test/asset-compute/worker/simple/file.jpg", "rendition.jpg"])
            .finally(() => {
                // cleanup afterwards
                fs.unlinkSync("rendition.jpg");
            })
            .it("runs a single worker if there is only one (without -a)", function() {
                assertExitCode(undefined);

                assert(fs.existsSync("rendition.jpg"));
                // check files are identical (the worker just copies source -> rendition)
                assert(fs.readFileSync("test/asset-compute/worker/simple/file.jpg").equals(fs.readFileSync("rendition.jpg")));

                // legacy build folder, ensure it does not come back
                assert(!fs.existsSync(".nui"));
                assertMissingOrEmptyDirectory("build", "run-worker");
            });

        testCommand("test-projects/multiple-workers", "asset-compute:run-worker", ["-a", "workerA", "test/asset-compute/workerA/testA/file.jpg", "rendition.jpg"])
            .finally(() => {
                fs.unlinkSync("rendition.jpg");
            })
            .it("runs the right worker if selected using -a", function(ctx) {
                assertExitCode(undefined);
                assert(ctx.stdout.includes("worker workerA run-worker in multiple-workers"));

                assert(fs.existsSync("rendition.jpg"));
                // check files are identical (the worker just copies source -> rendition)
                assert(fs.readFileSync("test/asset-compute/workerA/testA/file.jpg").equals(fs.readFileSync("rendition.jpg")));

                assert(!fs.existsSync(".nui"));
                assertMissingOrEmptyDirectory("build", "run-worker");
            });

        testCommand("test-projects/multiple-workers", "asset-compute:run-worker", ["-a", "workerB", "test/asset-compute/workerB/testB/file.jpg", "rendition.jpg"])
            .finally(() => {
                fs.unlinkSync("rendition.jpg");
            })
            .it("runs another worker if selected using -a", function(ctx) {
                assertExitCode(undefined);
                assert(ctx.stdout.includes("worker workerB run-worker in multiple-workers"));

                assert(fs.existsSync("rendition.jpg"));
                // check files are identical (the worker just copies source -> rendition)
                assert(fs.readFileSync("test/asset-compute/workerB/testB/file.jpg").equals(fs.readFileSync("rendition.jpg")));

                assert(!fs.existsSync(".nui"));
                assertMissingOrEmptyDirectory("build", "run-worker");
            });

        testCommand("test-projects/echo-params", "asset-compute:run-worker", ["package.json", "rendition.json", "-p", "key", "value"])
            .finally(() => {
                fs.unlinkSync("rendition.json");
            })
            .it("passes param set using -p", function() {
                assertExitCode(undefined);

                assert(fs.existsSync("rendition.json"));
                const result = JSON.parse(fs.readFileSync("rendition.json"));
                assert.equal(result.key, "value");

                assert(!fs.existsSync(".nui"));
                assertMissingOrEmptyDirectory("build", "run-worker");
            });

        testCommand("test-projects/echo-params", "asset-compute:run-worker", ["package.json", "rendition.json", "-P", "params.json"])
            .finally(() => {
                fs.unlinkSync("rendition.json");
            })
            .it("passes params from json file set using -P", function() {
                assertExitCode(undefined);

                assert(fs.existsSync("rendition.json"));
                const result = JSON.parse(fs.readFileSync("rendition.json"));
                assert.equal(result.greeting, "hello world");

                assert(!fs.existsSync(".nui"));
                assertMissingOrEmptyDirectory("build", "run-worker");
            });

        testCommand("test-projects/echo-params", "asset-compute:run-worker", ["package.json", "renditionDir", "-d", '{ "renditions": [{ "key": "value" }] }'])
            .finally(() => {
                rimraf.sync("renditionDir");
            })
            .it("passes params from json string set using -d with single rendition", function() {
                assertExitCode(undefined);

                const renditionPath = path.join("renditionDir", "rendition0");
                assert(fs.existsSync(renditionPath));
                const result = JSON.parse(fs.readFileSync(renditionPath));
                assert.equal(result.key, "value");

                assert(!fs.existsSync(".nui"));
                assertMissingOrEmptyDirectory("build", "run-worker");
            });

        const renditionJson = {
            renditions: [{
                name: "rendition1.json",
                key: "1"
            },{
                name: "rendition2.json",
                key: "2"
            }]
        };
        testCommand("test-projects/echo-params", "asset-compute:run-worker", ["package.json", "renditionDir", "-d", JSON.stringify(renditionJson)])
            .finally(() => {
                rimraf.sync("renditionDir");
            })
            .it("passes params from json string set using -d with multiple renditions and names", function() {
                assertExitCode(undefined);

                const rendition1Path = path.join("renditionDir", "rendition1.json");
                assert(fs.existsSync(rendition1Path));
                const result = JSON.parse(fs.readFileSync(rendition1Path));
                assert.equal(result.key, "1");

                const rendition2Path = path.join("renditionDir", "rendition2.json");
                assert(fs.existsSync(rendition2Path));
                const result2 = JSON.parse(fs.readFileSync(rendition2Path));
                assert.equal(result2.key, "2");

                assert(!fs.existsSync(".nui"));
                assertMissingOrEmptyDirectory("build", "run-worker");
            });

        testCommand("test-projects/with space", "asset-compute:run-worker", ["test/asset-compute/worker/simple/file.jpg", "rendition.jpg"])
            .finally(() => {
                // cleanup afterwards
                fs.unlinkSync("rendition.jpg");
            })
            .it("runs a single worker with a space in the path", function() {
                assertExitCode(undefined);

                assert(fs.existsSync("rendition.jpg"));
                // check files are identical (the worker just copies source -> rendition)
                assert(fs.readFileSync("test/asset-compute/worker/simple/file.jpg").equals(fs.readFileSync("rendition.jpg")));

                // legacy build folder, ensure it does not come back
                assert(!fs.existsSync(".nui"));
                assertMissingOrEmptyDirectory("build", "run-worker");
            });

        testCommand("test-projects/debug-log", "asset-compute:run-worker", ["test/asset-compute/worker/simple/file.jpg", "rendition.jpg"])
            .prepare(() => {
                process.env.WORKER_DEBUG = "myworker";
            })
            .it("passes WORKER_DEBUG env var through as DEBUG", function(ctx) {
                assert(ctx.stderr.includes(">>>> debug log is here <<<<") || ctx.stdout.includes(">>>> debug log is here <<<<"));
            });
    });

    describe("failure", function() {

        testCommand("test-projects/multiple-workers", "asset-compute:run-worker", ["test/asset-compute/worker/simple/file.jpg", "rendition.jpg"])
            .it("fails with exit code 1 if run on a project with multiple workers and no -a is set", function(ctx) {
                assertExitCode(1);
                assert(ctx.stderr.includes("Error: Must specify worker to run using --action"));

                assert(!fs.existsSync("rendition.jpg"));
                assert(!fs.existsSync(".nui"));
                assertMissingOrEmptyDirectory("build", "run-worker");
            });
    });
});