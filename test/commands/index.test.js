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

const IndexCommand = require("../../src/commands/asset-compute");
const {stdout} = require("stdout-stderr");
const assert = require("assert");

describe("index command", function() {

    it("should show help for asset-compute commands", async function() {
        stdout.start();
        await IndexCommand.run([]);
        stdout.stop();
        assert(stdout.output.startsWith("Develop and test Adobe Asset Compute workers"));
        assert(stdout.output.includes("asset-compute:run-worker   Run worker from local project using Docker"));
        assert(stdout.output.includes("asset-compute:test-worker  Run tests from local project"));
    });
});