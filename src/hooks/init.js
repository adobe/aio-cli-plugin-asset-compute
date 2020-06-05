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

// oclif init hook for running this oclif plugin in hybrid mode
// both as standalone cli and as plugin for another oclif cli

// <topic>:<command> => <command>
function removeTopic(id) {
    // will keep the original string if no ":" found
    return id.substring(id.indexOf(":") + 1);
}

module.exports = async function (opts) {
    // check if we run as standalone cli or as part of another plugin
    // by checking if the root package.json name that oclif sees is ours
    if (opts.config.pjson.name === require("../../package.json").name) {
        // drop the topic to move commands to the top level
        opts.config.commands.forEach(command => {
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