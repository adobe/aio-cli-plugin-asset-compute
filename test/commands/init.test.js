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

const init = require("../../src/hooks/init");
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

describe("init - plugin devDependency", function() {

    const GLOBAL_INSTALLED_PLUGIN_ROOT = "/usr/local/lib/node_modules/@adobe/aio-cli-plugin-asset-compute";
    const TEST_PROJECT_WITH_DEVDEPENDENCY = path.resolve("test-projects/use-devDependency");
    const TEST_PROJECT_WITHOUT_DEVDEPENDENCY = path.resolve("test-projects/single-worker");

    function cdProjectAndInstall(path) {
        process.chdir(path);
        // install dependencies for the project
        if (!fs.existsSync("node_modules")) {
            execSync("npm install");
        }
    }

    function makeOclifConfig(config) {
        config.loadPlugins = async function(path, type, plugins) {
            plugins.forEach(pluginOpts => this.plugins.push({ options: pluginOpts }));
        };
        config.plugins = config.plugins || [];
        config.commands = config.commands || [];
        return config;
    }

    it("uses the devDependency of the project if run by aio", async function() {
        const config = makeOclifConfig({
            pjson: {
                name: "@adobe/aio-cli" // not standalone
            },
            plugins: [{
                options: {
                    type: "user",
                    root: GLOBAL_INSTALLED_PLUGIN_ROOT,
                    name: "@adobe/aio-cli-plugin-asset-compute",
                }
            }, {
                options: {
                    type: 'core',
                    root: '/usr/local/lib/node_modules/@adobe/aio-cli',
                    name: '@adobe/aio-cli-plugin-events'
                }
            }]
        });

        cdProjectAndInstall(TEST_PROJECT_WITH_DEVDEPENDENCY);
        await init({ config });

        // verify previous plugin was removed
        assert.ok(config.plugins.every(plugin => plugin.options.root !== GLOBAL_INSTALLED_PLUGIN_ROOT), "global installed plugin still present");

        // verify local devDependency was added as plugin
        assert.ok(config.plugins.some(
            plugin => plugin.options.name === "@adobe/aio-cli-plugin-asset-compute"
                      && plugin.options.root === path.resolve("node_modules/@adobe/aio-cli-plugin-asset-compute")
        ), "local devDependency plugin is missing");

    }).timeout(30000); // because of the npm install

    it("adds itself even if it can't find itself in the plugin list", async function() {
        const config = makeOclifConfig({
            pjson: {
                name: "@adobe/aio-cli" // not standalone
            },
            plugins: [{
                options: {
                    type: 'core',
                    root: '/usr/local/lib/node_modules/@adobe/aio-cli',
                    name: '@adobe/aio-cli-plugin-events'
                }
            }]
        });

        cdProjectAndInstall(TEST_PROJECT_WITH_DEVDEPENDENCY);
        await init({ config });

        // verify previous plugin was removed
        assert.ok(config.plugins.every(plugin => plugin.options.root !== GLOBAL_INSTALLED_PLUGIN_ROOT), "global installed plugin still present");

        // verify local devDependency was added as plugin
        assert.ok(config.plugins.some(
            plugin => plugin.options.name === "@adobe/aio-cli-plugin-asset-compute"
                      && plugin.options.root === path.resolve("node_modules/@adobe/aio-cli-plugin-asset-compute")
        ), "local devDependency plugin is missing");
    });

    it("uses itself if run as standalone cli", async function() {
        const config = makeOclifConfig({
            pjson: {
                name: "@adobe/aio-cli-plugin-asset-compute" // standalone
            },
            plugins: [{
                options: {
                    type: "user",
                    root: GLOBAL_INSTALLED_PLUGIN_ROOT,
                    name: "@adobe/aio-cli-plugin-asset-compute",
                }
            }, {
                options: {
                    type: 'core',
                    root: '/usr/local/lib/node_modules/@adobe/aio-cli',
                    name: '@adobe/aio-cli-plugin-events'
                }
            }]
        });

        cdProjectAndInstall(TEST_PROJECT_WITH_DEVDEPENDENCY);
        await init({ config });

        // verify local devDependency was added as plugin
        assert.ok(config.plugins.some(
            plugin => plugin.options.name === "@adobe/aio-cli-plugin-asset-compute"
                      && plugin.options.root === GLOBAL_INSTALLED_PLUGIN_ROOT
        ), "local devDependency plugin is missing");
    });

    it("uses itself if run as aio plugin without a devDependency in the project", async function() {
        const config = makeOclifConfig({
            pjson: {
                name: "@adobe/aio-cli" // not standalone
            },
            plugins: [{
                options: {
                    type: "user",
                    root: GLOBAL_INSTALLED_PLUGIN_ROOT,
                    name: "@adobe/aio-cli-plugin-asset-compute",
                }
            }, {
                options: {
                    type: 'core',
                    root: '/usr/local/lib/node_modules/@adobe/aio-cli',
                    name: '@adobe/aio-cli-plugin-events'
                }
            }]
        });

        cdProjectAndInstall(TEST_PROJECT_WITHOUT_DEVDEPENDENCY);
        await init({ config });

        // verify global plugin is still there
        assert.ok(config.plugins.some(
            plugin => plugin.options.name === "@adobe/aio-cli-plugin-asset-compute"
                      && plugin.options.root === GLOBAL_INSTALLED_PLUGIN_ROOT
        ), "global installed plugin was removed");

        // verify there is only one plugin with our name
        assert.strictEqual(1, config.plugins.reduce((count, plugin) => plugin.options.name === "@adobe/aio-cli-plugin-asset-compute" ? count + 1 : count, 0));

    }).timeout(30000); // because of the npm install
});

describe("init - plugin command prefixes", function() {

    it("standalone cli: removes asset-compute prefix", async function() {
        const config = {
            pjson: {
                name: "@adobe/aio-cli-plugin-asset-compute" // standalone
            },
            commands: [{
                id: 'plugins:update',
                pluginName: '@oclif/plugin-plugins',
                pluginType: 'core',
                aliases: []
            },{
                id: 'asset-compute',
                description: 'Develop and test Adobe Asset Compute workers',
                pluginName: '@adobe/aio-cli-plugin-asset-compute',
                pluginType: 'core',
                aliases: []
            },
            {
                id: 'asset-compute:devtool',
                description: 'Starts the Asset Compute Developer Tool',
                pluginName: '@adobe/aio-cli-plugin-asset-compute',
                pluginType: 'core',
                aliases: []
            },
            {
                id: 'asset-compute:run-worker',
                description: 'Run worker from local project using Docker',
                pluginName: '@adobe/aio-cli-plugin-asset-compute',
                pluginType: 'core',
                aliases: []
            },
            {
                id: 'asset-compute:test-worker',
                description: 'Run tests from local project',
                pluginName: '@adobe/aio-cli-plugin-asset-compute',
                pluginType: 'core',
                aliases: [ 'asset-compute:tw' ]
            }]
        };

        await init({ config });

        // assert no more `asset-compute:` prefixes
        assert.ok(config.commands.every(command => !command.id.startsWith("asset-compute:")), "still has commands with asset-compute: prefix");

        // assert index command is hidden
        assert.ok(config.commands.every(command => command.id !== "asset-compute" || command.hidden), "asset-compute index command is not hidden");
    });

    it("aio cli: keep asset-compute prefix", async function() {
        const config = {
            pjson: {
                name: "@adobe/aio-cli" // not standalone
            },
            commands: [{
                id: 'plugins:update',
                pluginName: '@oclif/plugin-plugins',
                pluginType: 'core',
                aliases: []
            },{
                id: 'asset-compute',
                description: 'Develop and test Adobe Asset Compute workers',
                pluginName: '@adobe/aio-cli-plugin-asset-compute',
                pluginType: 'core',
                aliases: []
            },
            {
                id: 'asset-compute:devtool',
                description: 'Starts the Asset Compute Developer Tool',
                pluginName: '@adobe/aio-cli-plugin-asset-compute',
                pluginType: 'core',
                aliases: []
            },
            {
                id: 'asset-compute:run-worker',
                description: 'Run worker from local project using Docker',
                pluginName: '@adobe/aio-cli-plugin-asset-compute',
                pluginType: 'core',
                aliases: []
            },
            {
                id: 'asset-compute:test-worker',
                description: 'Run tests from local project',
                pluginName: '@adobe/aio-cli-plugin-asset-compute',
                pluginType: 'core',
                aliases: [ 'asset-compute:tw' ]
            }]
        };

        await init({ config });

        // assert no more `asset-compute:` prefixes
        assert.ok(config.commands.every(command =>
            command.id === "plugins:update"
            || command.id.startsWith("asset-compute")), "lost asset-compute: prefix");

        // assert index command is hidden
        assert.ok(config.commands.every(command => command.id !== "asset-compute" || !command.hidden), "asset-compute index command must not be hidden");
    });});