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

// const { test: oclifTest } = require("@oclif/test");
const {stdout} = require("stdout-stderr");
const mock = require('mock-require');
const assert = require("assert");
const promisify = require('util').promisify;
const sleep = promisify(setTimeout);
const fetch = require('node-fetch');

describe("devtool command", function() {
    beforeEach(() => {
        mock('open', async function() {
            return Promise.resolve();
        });
    });
    afterEach(() => {
        mock.stopAll();
    });
    it("devtool starts and serves html", async function() {
        const DevToolCommand = require("../../src/commands/asset-compute/devtool");
        stdout.start();
        const devtool = new DevToolCommand([]);
        devtool.run([]);
        await sleep(200);
        const port = devtool.server.address().port;
        stdout.stop();
        await devtool.stop();

        console.log('stdout', stdout.output);
        const stdoutList = stdout.output.split('\n');
        assert.strictEqual(stdoutList[0], `Starting Asset Compute Developer Tool Server on port ${port}`);
        assert.ok(stdoutList[1], `Listening on port ${port}`);
        assert(stdoutList[2].includes(`Asset Compute Developer Tool Server started on url http://localhost:${port}/?devToolToken=`));

    });

    it("server starts up and does an api call", async function() {
        const DevToolCommand = require("../../src/commands/asset-compute/devtool");
        stdout.start();
        const devtool = new DevToolCommand([]);
        devtool.run([]);
        await sleep(200);
        // const port = devtool.server.address().port;
        
        console.log('stdout', stdout.output);
        const stdoutList = stdout.output.split('\n');
        const url = stdoutList[2].split(' ').pop();
        stdout.stop();
        console.log(url);
        const resp = await fetch(url);
        console.log('resp', resp);
        await devtool.stop();
    });
    it("authorization fails", async function() {

    });

    /*
    describe("success", function() {
        process.env.TEST_OUTPUT = 1;
        console.log('tesst');

        oclifTest
		    .stdout()
            .stderr()
            .do(async (ctx) => {
                console.log('context', ctx);
                
            })
            .command(['devtool'])
            .timeout(50)
            .catch(e => console.log(e))
            .it("runs a single worker if there is only one (without -a)", function(ctx) {
                console.log('output', ctx.stdout);
                // process.exit(0);
				
            });
    });
    */
});