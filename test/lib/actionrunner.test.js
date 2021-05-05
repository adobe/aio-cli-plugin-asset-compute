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

const OpenwhiskActionRunner = require("../../src/lib/actionrunner");
const assert = require("assert");
const nock = require("nock");

describe("actionrunner tests", function() {


    it("creates new action runner instance", async function() {
        const actionRunner = new OpenwhiskActionRunner({
            action: {
                exec: {
                    code: 'action.zip'
                }
            }
        });
        assert.ok(actionRunner instanceof OpenwhiskActionRunner);
    });
    it("failure during action initalization, body is empty", async function() {
        const actionRunner = new OpenwhiskActionRunner({
            action: {
                exec: {
                    kind: 'nodejs:10',
                    binary: true,
                    code: '2435'
                }
            }
        });
        const containerHost = '0.0.0.0:2435::::2345';
        nock(`http://${containerHost}`).post("/init").reply(400, "Bad Request");

        // mock docker to avoid errors with trying to get logs
        actionRunner._docker = () => {};
        // mock container host so we can mock the exact url
        actionRunner.containerHost = containerHost;
        try {
            await actionRunner._initAction();
        } catch (error) {
            assert.strictEqual(error.message, 'Could not init action on container (POST http://0.0.0.0:2435::::2345/init: responded with error: "Bad Request"');
        }
    }).timeout(30000);

});