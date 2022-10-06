/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

"use strict";

const { Command, Flags } = require('@oclif/core');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const path = require('path');
const libRuntime = require("@adobe/aio-lib-runtime");
const debug = require('debug')('aio-asset-compute.base');
const loadConfig = require('@adobe/aio-cli-lib-app-config');
// imported like this so that we can overwrite child_process.spawnSync in unit tests
const child_process = require("child_process");

const ASSET_COMPUTE_EXT_PATH = "dx/asset-compute/worker/1"; // path to asset compute extension
const ASSET_COMPUTE_ACTION_PATH = "dx-asset-compute-worker-1"; // path to Asset Compute Worker actions in manifest

// converts action object from manifest.yml to openwhisk rest API json format
function aioManifestToOpenwhiskAction(manifestAction) {
    const owAction = libRuntime.utils.createActionObject(manifestAction.name, manifestAction);
    if (owAction.action) {
        owAction.exec.binary = true;
        owAction.exec.code = owAction.action.toString("base64");
        delete owAction.action;
    }
    owAction.params = libRuntime.utils.processInputs(manifestAction.inputs, {});
    owAction.name = manifestAction.name;

    return owAction;
}

async function execute(command, args) {
    // shell => required for Windows
    const result = child_process.spawnSync(command, args, {shell: true, stdio: "inherit"});

    if (result.error) {
        if (result.error.code === 'ENOENT') {
            throw new Error(`Could not find command '${command}': ${result.error.message}`);
        } else {
            throw new Error(`Failed to execute '${command} ${args.join(" ")}': ${result.error.message}`);
        }
    }
}

class BaseCommand extends Command {

    // Get config object in newer version of aio projects (aio-cli v8 and above)
    // app structure is more flexible now and Asset Compute Extensions can be anywhere in the project
    // Use AIO's config loader to find all Asset Compute Extension configs: 
    // https://github.com/adobe/aio-cli-plugin-app/blob/master/src/lib/config-loader.js
    get aioConfig() {
        if (!this._aioConfig) {
            try {
                const fullConfig = loadConfig();
                const assetComputeConfig = fullConfig.all[ASSET_COMPUTE_EXT_PATH];
                this._aioConfig = assetComputeConfig;
            } catch (error) {
                console.log("Error loading AIO Asset Compute Extension config. This is likely because you are using an older version of the aio cli", error.message);
            }
        }
        return this._aioConfig;
    }

    get manifest() {
        if (!this._manifest) {

            if (this.aioConfig) {
                this._manifest = this.aioConfig.manifest.full;
            } else {
                // Stay backwards compatible with older aio project structure (aio-cli v7 and below)
                this._manifest = yaml.safeLoad(fs.readFileSync('manifest.yml', 'utf8'));
            }
        }
        return this._manifest;
    }

    get actions() {
        if (this.manifest.packages) {
            const appPackage =  this.manifest.packages[ASSET_COMPUTE_ACTION_PATH] || this.manifest.packages.__APP_PACKAGE__;
            if (appPackage) {
                return appPackage.actions;
            }
        }
        return {};
    }

    get actionNames() {
        return Object.keys(this.actions);
    }

    action(name) {
        const action = this.actions[name];
        if (!action) {
            throw new Error(`Action not found in manifest: ${name}`);
        }
        action.name = name;
        return action;
    }

    async runAioCommand(command, args) {
        const CommandClass = this.config.findCommand(command);
        if (CommandClass) {
            // if run as aio plugin, note: oclif2 class loader is async
            const cmd = await CommandClass.load();
            await cmd.run(args);
        } else {
            // if run as standalone cli
            await execute("aio", [command, ...args]);
        }
    }

    async buildActionZip(actionName) {
        try {
            await this.runAioCommand("app:build", ["-a", actionName]);
        } catch (e) {
            throw new Error(`Failed to build action: ${e.message}`);
        }

        let actionZip;
        if (this.aioConfig) {
            actionZip = path.join(this.aioConfig.actions.dist, `${actionName}.zip`);
        } else {
            // Stay backwards compatible with older aio project structure (aio-cli v7 and below)
            // actionZip = path.resolve("dist/actions", `${actionName}.zip`);
            actionZip = path.resolve("dist/application/actions", `${actionName}.zip`);
        }
        if (!fs.existsSync(actionZip)) {
            throw new Error(`Building action failed, did not create ${actionZip}`);
        }
        return actionZip;
    }

    async openwhiskAction(name) {
        // clone object so we don't overwrite the "function" field on the original object
        const manifestAction = {
            ...this.action(name)
        };

        debug("building action zip...");
        manifestAction.function = await this.buildActionZip(name);

        debug("aio manifest action:", manifestAction);

        return aioManifestToOpenwhiskAction(manifestAction);
    }

    get buildDir() {
        if (!this._buildDir) {
            this._buildDir = process.env.AIO_BUILD_DIR || "build";
        }
        return this._buildDir;
    }

    getBuildDir(...subdirs) {
        return path.join(this.buildDir, ...subdirs);
    }

    onProcessExit(handler) {
        const SIGNALS = {
            SIGINT:  2, // ctrl+c
            SIGTERM: 15 // plain kill
        };

        Object.keys(SIGNALS).forEach(signal => {
            // register process signal handler
            process.on(signal, async (sig) => {
                await handler(sig);

                // replicate standard unix/nodejs behavior
                process.exit(128 + SIGNALS[sig]);
            });
        });
    }
}

BaseCommand.flags = {
    verbose: Flags.boolean({ char: 'v', description: 'Verbose output' }),
    version: Flags.boolean({ description: 'Show version' })
};

BaseCommand.args = [];

module.exports = BaseCommand;
