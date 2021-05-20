/*
 * Copyright 2019 Adobe Inc. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
'use strict'

const { worker } = require('@adobe/asset-compute-sdk');
const fs = require('fs').promises;
const debug = require('debug')('myworker');
const sleep = require('util').promisify(setTimeout);

exports.main = worker(async (source, rendition) => {
    // copy source to rendition to transfer 1:1
    await fs.copyFile(source.path, rendition.path);

    // must sleep because otherwise logs aren't caught by test runner & docker logs
    await sleep(1000);
    debug(">>>> debug log is here <<<<");
});
