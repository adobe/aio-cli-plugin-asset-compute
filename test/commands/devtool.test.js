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
        // set up server
        const DevToolCommand = require("../../src/commands/asset-compute/devtool");
        stdout.start();
        const devtool = new DevToolCommand([]);
        devtool.run([]);
        await sleep(50);
        const port = devtool.server.address().port;
        stdout.stop();

        // check start up logs
        const stdoutList = stdout.output.split('\n');
        assert.strictEqual(stdoutList[0], `Starting Asset Compute Developer Tool Server on port ${port}`);
        assert.ok(stdoutList[1], `Listening on port ${port}`);
        assert(stdoutList[2].includes(`Asset Compute Developer Tool Server started on url http://localhost:${port}/?devToolToken=`));
        const url = stdoutList[2].split(' ').pop();
        assert.ok(url.includes(`http://localhost:${port}/?devToolToken=`));

        // api call to get raw html
        const resp = await fetch(url);
        assert.strictEqual(resp.status, 200);
        const html = await resp.text();
        assert.ok(html.includes('/static/js'));
        await devtool.stop();
    });

    it("server starts up and does an api call", async function() {
        this.timeout(5000);
        // set up server
        const DevToolCommand = require("../../src/commands/asset-compute/devtool");
        stdout.start();
        const devtool = new DevToolCommand([]);
        devtool.run([]);
        await sleep(50);

        // check output
        const port = devtool.server.address().port;
        const stdoutList = stdout.output.split('\n');
        const url = stdoutList[2].split(' ').pop();
        const token = url.split('=')[1];
        assert.strictEqual(token.length, 64);
        assert.ok(url.includes(`http://localhost:${port}/?devToolToken=`));
        stdout.stop();

        // api call to get raw html
        const resp = await fetch(`http://localhost:${port}/api/asset-compute-endpoint`, {
            headers: {
                "authorization": token,
            }
        });

        assert.strictEqual(resp.status, 200);
        assert.deepStrictEqual(await resp.json(), { endpoint: 'https://asset-compute.adobe.io/' } );
        await devtool.stop();
    });
    it("server starts up and fails an api call without authorization", async function() {
        this.timeout(5000);
        // set up server
        const DevToolCommand = require("../../src/commands/asset-compute/devtool");
        stdout.start();
        const devtool = new DevToolCommand([]);
        devtool.run([]);
        await sleep(50);

        // check output
        const port = devtool.server.address().port;
        stdout.stop();

        // api call to get raw html
        const resp = await fetch(`http://localhost:${port}/api/asset-compute-endpoint`, {
            headers: {
                "authorization": "fake token",
            }
        });

        assert.strictEqual(resp.status, 401);
        assert.deepStrictEqual(await resp.json(), { message: 'Unauthorized' } );
        await devtool.stop();
    });
});