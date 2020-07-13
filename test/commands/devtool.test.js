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
const assert = require("assert");
const promisify = require('util').promisify;
const sleep = promisify(setTimeout);
const fetch = require('node-fetch');
const mock = require('mock-require');

mock('open', () => {});
const DevToolCommand = require("../../src/commands/asset-compute/devtool");

const SERVER_START_UP_WAIT_TIME = 500; // ms to wait while server starts up
const TIMEOUT = 5000;
const SLEEP = 2000;

describe("devtool command", function() {
    it("devtool starts and serves html", async function() {
        // set up server
        const port = 8888;
        stdout.start();
        const devtool = new DevToolCommand([]);
        devtool.run(port);
        await sleep(SERVER_START_UP_WAIT_TIME);
        stdout.stop();

        // check start up logs
        const stdoutList = stdout.output.split('\n');
        const regex = new RegExp(`Asset Compute Developer Tool Server started on url  http://localhost:${port}/\\?devToolToken=[a-zA-Z0-9].*`);
        assert.strictEqual(regex.test(stdoutList[0]), true);

        const url = stdoutList[0].split(' ').pop();
        assert.ok(url.includes(`http://localhost:${port}/?devToolToken=`));

        const token = url.split('=')[1];
        assert.strictEqual(token.length, 64);

        // api call to get raw html
        const resp = await fetch(url);
        assert.strictEqual(resp.status, 200);
        const html = await resp.text();
        assert.ok(html.includes('/static/js'));
    });

    it("server starts up and does an api call", async function() {
        this.timeout(TIMEOUT);
        // set up server
        const port = 7777;
        stdout.start();
        const devtool = new DevToolCommand([]);
        devtool.run(port);
        await sleep(SLEEP);
        stdout.stop();

        // check output
        const stdoutList = stdout.output.split('\n');
        const url = stdoutList[0].split(' ').pop();
        assert.ok(url.includes(`http://localhost:${port}/?devToolToken=`));

        const token = url.split('=')[1];
        assert.strictEqual(token.length, 64);

        // api call to get raw html
        const resp = await fetch(`http://localhost:${port}/api/asset-compute-endpoint`, {
            headers: {
                "authorization": token,
            }
        });

        assert.strictEqual(resp.status, 200);
        const body = await resp.json();
        assert.ok(body.endpoint.includes('https://asset-compute.adobe.io'));
    });

    it("server starts up and does an api call with no port specified", async function () {
        this.timeout(TIMEOUT);
        // set up server
        const port = 9000;
        stdout.start();
        const devtool = new DevToolCommand([]);
        devtool.run();
        await sleep(SLEEP);
        stdout.stop();

        // check output
        const stdoutList = stdout.output.split('\n');
        const url = stdoutList[0].split(' ').pop();
        assert.ok(url.includes(`http://localhost:${port}/?devToolToken=`));

        const token = url.split('=')[1];
        assert.strictEqual(token.length, 64);

        // api call to get raw html
        const resp = await fetch(`http://localhost:${port}/api/asset-compute-endpoint`, {
            headers: {
                "authorization": token,
            }
        });

        assert.strictEqual(resp.status, 200);
        const body = await resp.json();
        assert.ok(body.endpoint.includes('https://asset-compute.adobe.io'));
    });

    it("server starts up and fails an api call without authorization", async function() {
        this.timeout(TIMEOUT);
        // set up server
        const port = 5555;
        stdout.start();
        const devtool = new DevToolCommand([]);
        devtool.run(port);
        await sleep(SERVER_START_UP_WAIT_TIME);
        stdout.stop();

        // check output
        // api call to get raw html
        const resp = await fetch(`http://localhost:${port}/api/asset-compute-endpoint`, {
            headers: {
                "authorization": "fake token",
            }
        });

        assert.strictEqual(resp.status, 401);
        assert.deepStrictEqual(await resp.json(), { message: 'Unauthorized' } );
    });
});
