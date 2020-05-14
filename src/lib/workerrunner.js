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

'use strict';

const OpenwhiskActionRunner = require("./actionrunner");

/**
 * Runs an asset compute worker action using a local container and provides access
 * for sources and renditions by mounting in and out folders on the host.
 */
class AssetComputeWorkerRunner extends OpenwhiskActionRunner {

    constructor(options) {
        super({
            action: options.action,
            containerName: options.containerName,
            env: {
                WORKER_TEST_MODE: "true",
                ...options.env
            },
            mounts: {
                [options.sourceDir]: "/in:ro",
                [options.targetDir]: "/out",
                ...options.mounts
            }
        });
    }
}

module.exports = AssetComputeWorkerRunner;