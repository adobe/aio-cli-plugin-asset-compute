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

'use strict';

// oclif init hook

const path = require("path");
const fs = require("fs");

function removeOclifPlugin(config, name) {
    for (let i = 0; i < config.plugins.length; i++) {
        const plugin = config.plugins[i];
        if (plugin.options && plugin.options.name === name) {
            config.plugins.splice(i, 1);
            break;
        }
    }
}

async function addOclifPlugin(config, name, path) {
    await config.loadPlugins(path, "user", [{
        type: "user",
        name: name,
        root: path
    }]);
}

async function loadOclifPlugin(config, name, pluginPath) {
    pluginPath = path.resolve(pluginPath);

    if (fs.existsSync(pluginPath)) {
        // remove any existing occurrence
        removeOclifPlugin(config, name);

        await addOclifPlugin(config, name, pluginPath);

        return require(path.resolve(pluginPath, "package.json"));
    }
}

// <topic>:<command> => <command>
function removeTopic(id) {
    // will keep the original string if no ":" found
    return id.substring(id.indexOf(":") + 1);
}

module.exports = async function( {config} ) {
    // check if we run as standalone cli or as part of another plugin
    // by checking if the root package.json name that oclif sees is ours
    const moduleName = require("../../package.json").name;
    const runsStandalone = config.pjson.name === moduleName;

    // when running as aio plugin, we prefer to use the locally installed version
    // in the devDependencies of the aio project; so we dynamically load this
    // from there (instead of using our own plugin commands)
    if (!runsStandalone) {
        const pjson = await loadOclifPlugin(config, moduleName, `node_modules/${moduleName}`);
        if (pjson) {
            console.log(`Using local project's ${moduleName} version ${pjson.version}\n`);
        }
    }

    // this plugin can be run both as standalone cli and as oclif plugin for aio
    // in standalone mode we don't want the "asset-compute:" topic prefix
    if (runsStandalone) {
        // drop the topic to move commands to the top level
        config.commands.forEach(command => {
            if (command.id.indexOf(":") < 0) {
                // hide any "index" command for the topic itself
                command.hidden = true;
            } else {
                command.id = removeTopic(command.id);
                command.aliases = command.aliases.map(removeTopic);
            }
        });
    }
};