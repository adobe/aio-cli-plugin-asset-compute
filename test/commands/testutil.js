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

const MockServer = require("../../src/lib/mockserver");
const WorkerTestRunner = require("../../src/lib/testrunner");

const { test: oclifTest } = require("@oclif/test");
const stdmock = require("stdout-stderr");
const path = require("path");
const { execSync } = require("child_process");
const rimraf = require("rimraf");
const assert = require("assert");
const Docker = require("dockerode");
const fs = require("fs");

const ANSI_RESET = "\x1b[0m";
const ANSI_RED = "\x1b[31m";
const MOCHA_TEST_TIMEOUT_MSEC = 70000;

// to enable logging set this before the test:
// process.env.TEST_OUTPUT = 1;

const baseDir = process.cwd();

function testCommand(dir, command, args=[]) {
    let prepareFn;

    const chain = oclifTest
        .stdout()
        .stderr()
        .do(() => {
            process.chdir(path.join(baseDir, dir));

            // make sure it builds a fresh action.zip
            rimraf.sync("dist");
            // remove temp directories
            rimraf.sync("build");

            // install dependencies for the project
            if (!fs.existsSync("node_modules")) {
                execSync("npm install");
            }

            // 1 sec to ensure docker log output
            process.env.AIO_ASSET_COMPUTE_LOG_DELAY = 1000;
        })
        .do(async ctx => {
            if (prepareFn) {
                await prepareFn(ctx);
            }
            
        })
        // run the command to test
        .command([command, ...args])
        // npm install can take some time
        .timeout(MOCHA_TEST_TIMEOUT_MSEC)
        .do(async () => {
            // general assertions for all tests

            await assertDockerRemoved();
        })
        .finally(ctx => {
            // reset any exit code set by failing tests
            delete process.exitCode;

            delete process.env.AIO_ASSET_COMPUTE_LOG_DELAY;

            // log stdout/stderr if test failed
            if (ctx.error) {
                stdmock.stdout.stop();
                stdmock.stderr.stop();

                console.log(ANSI_RED);
                console.log("      ---------------------------------------------------------------------------------");
                console.log("      test failed, possibly because the following output did not meet expectations:");
                console.log("      ---------------------------------------------------------------------------------");
                console.log(ANSI_RESET);

                console.log(ctx.stdout);
                console.error(ctx.stderr);

                console.log(ANSI_RED + "      ---------------------------------------------------------------------------------" + ANSI_RESET);
            }
        });

    chain.prepare = function(fn) {
        prepareFn = fn;
        return this;
    };

    return chain;
}

async function assertDockerRemoved() {
    const docker = new Docker();

    for (const container of await docker.listContainers({all: true})) {
        for (let name of container.Names) {
            // all names here start with a /
            name = name.substring(1);
            if (name.startsWith(WorkerTestRunner.CONTAINER_PREFIX)
                || name.startsWith(MockServer.CONTAINER_PREFIX)) {
                assert.fail(`Docker container left behind (${container.State}): ${name} ` +
                            `If unsure, remove using 'docker rm -f ${name}' and run tests again`);
            }
        }
    }

    for (const network of await docker.listNetworks()) {
        if (network.Name.startsWith(MockServer.NETWORK_PREFIX)) {
            assert.fail(`Docker network left behind: ${network.Name} ` +
                        `If unsure, remove using 'docker network rm ${network.Name}' and run tests again`);
        }
    }
}

function assertExitCode(expectedCode) {
    assert.equal(process.exitCode, expectedCode, `unexpected exit code: ${process.exitCode}, expected: ${expectedCode}`);
}

function assertOccurrences(str, substr, expectedCount) {
    assert.equal(str.split(substr).length - 1, expectedCount);
}

function assertMissingOrEmptyDirectory(...pathElements) {
    const fullPath = path.join(...pathElements);
    assert.ok(!fs.existsSync(fullPath) || fs.readdirSync(fullPath).length === 0, `directory ${fullPath} is not empty`);
}


module.exports = {
    testCommand,
    assertExitCode,
    assertOccurrences,
    assertMissingOrEmptyDirectory
};