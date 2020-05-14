/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

"use strict";

const { Command, flags } = require('@oclif/command');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const path = require('path');
const ioruntime = require("@adobe/aio-cli-plugin-runtime");
const debug = require('debug')('aio-asset-compute.base');

// converts action object from manifest.yml to openwhisk rest API json format
function aioManifestToOpenwhiskAction(manifestAction) {
    const owAction = ioruntime.createActionObject(manifestAction, {});
    if (owAction.action) {
        owAction.exec.binary = true;
        owAction.exec.code = owAction.action.toString("base64");
        delete owAction.action;
    }
    owAction.params = ioruntime.processInputs(manifestAction.inputs, {});
    owAction.name = manifestAction.name;

    return owAction;
}

class BaseCommand extends Command {

    get pjson() {
        if (!this._pjson) {
            this._pjson = fs.readJSONSync('package.json');
        }
        return this._pjson;
    }

    get manifest() {
        if (!this._manifest) {
            this._manifest = yaml.safeLoad(fs.readFileSync('manifest.yml', 'utf8'));
        }
        return this._manifest;
    }

    get actions() {
        if (this.manifest.packages && this.manifest.packages.__APP_PACKAGE__) {
            return this.manifest.packages.__APP_PACKAGE__.actions;
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

    async runCommand(command, args) {
        const CommandClass = this.config.findCommand(command);
        if (CommandClass) {
            const cmd = CommandClass.load();
            await cmd.run(args);
        }
    }

    async buildActionZip(actionName) {
        await this.runCommand("app:deploy", ["--skip-deploy", "-a", actionName]);
        const zip = path.resolve("dist/actions", `${actionName}.zip`);
        if (!fs.existsSync(zip)) {
            throw new Error(`Building action failed, did not create ${zip}`);
        }
        return zip;
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

    getActionSourceDir(name) {
        const action = this.actions[name];
        if (action.function) {
            return path.dirname(path.resolve(action.function));
        } else {
            throw new Error(`Action '${name}' has no field 'function' in manifest.yml pointing to its sources.`);
        }
    }

    get appName() {
        return this.pjson.name;
    }

    get appVersion() {
        return this.pjson.version;
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
    verbose: flags.boolean({ char: 'v', description: 'Verbose output' }),
    version: flags.boolean({ description: 'Show version' })
};

BaseCommand.args = [];

module.exports = BaseCommand;
