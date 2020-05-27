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
const BaseCommand = require("../../src/base-command");

const { test: oclifTest } = require("@oclif/test");
const stdmock = require("stdout-stderr");
const path = require("path");
const { execSync } = require("child_process");
const rimraf = require("rimraf");
const assert = require("assert");
const Docker = require("dockerode");

const baseDir = process.cwd();

const COMMANDS = {
    "app:deploy": "@adobe/aio-cli-plugin-app/src/commands/app/deploy"
};

// tests are not running in a full oclif enviroment with the aio app plugin present,
// so we have to include it as a dev dependency and manually load and run the commands
// the code is invoking dynamically, by overwriting our BaseCommand.runCommand() helper
BaseCommand.prototype.runCommand = async (command, argv) => {
    if (COMMANDS[command]) {
        await require(COMMANDS[command]).run(argv);
    } else {
        throw new Error(`Missing test implementation of aio command ${command}`);
    }
};

// to enable logging set this before the test:
// process.env.TEST_OUTPUT = 1;

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
            rimraf.sync(".nui");

            // install dependencies for the project
            execSync("npm install");
        })
        .do(async ctx => {
            if (prepareFn) {
                await prepareFn(ctx);
            }
        })
        // run the command to test
        .command([command, ...args])
        // npm install can take some time
        .timeout(30000)
        .do(async () => {
            // general assertions for all tests

            await assertDockerRemoved();
        })
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

module.exports = {
    testCommand,
    assertExitCode,
    assertOccurrences
};