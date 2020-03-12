/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
/* eslint-disable dot-notation */

'use strict';


const util = require('./util');
const wskprops = require('./wskprops');
const { execSync } = require('child_process');
const openwhisk = require('openwhisk');
const fse = require('fs-extra');
const os = require("os");
const path = require('path');
const prettyBytes = require('pretty-bytes');
const Zip = require('adm-zip');
const { red, yellow } = require('chalk');

const DEFAULT_KIND = "nodejs:10";

class OpenWhisk {

    /**
     * Options:
     * - package
     * - verbose
     * - dryRun
     * - ignoreCerts
     * - production
     * - disableDockerCheck
     */
    constructor(options) {
        this.options = options;
        if (this.options.package) {
            this.options.package = this.options.package.replace(/\/$/, '');
        }

        this.wskProps = wskprops.get();
        if (options.ignoreCerts) {
            this.wskProps.ignore_certs = true;
        }
        this.dockerImages = {};
    }

    // lazy getter pattern: https://stackoverflow.com/a/37978698/2709
    get wsk() {
        const wsk = openwhisk(this.wskProps);
        Object.defineProperty(this, "wsk", { value: wsk, writable: false });
        return this.wsk;
    }

    logEnvironment() {
        util.log("OpenWhisk Environment:")
        console.log("* Server     :", this.wskProps.apihost);
        console.log("* Namespace  :", this.wskProps.namespace);
        if (this.options.package) {
            console.log("* Package    :", this.options.package);
        }
    }

    getSequences(pkgJson) {
        if (pkgJson.openwhisk && pkgJson.openwhisk.sequences) {
            const sequences = pkgJson.openwhisk.sequences;
            if (typeof sequences !== "object") {
                throw new Error("'openwhisk.sequences' in package.json must be an object.");
            }
            return Object.keys(sequences).map(name => {
                const s = sequences[name];
                // normalize
                if (Array.isArray(s)) {
                    return {
                        action: name,
                        components: s
                    };
                } else if (typeof s === "object") {
                    if (s.components) {
                        s.action = name;
                        return s;
                    } else {
                        throw new Error("Sequence does not specify components:", s);
                    }
                } else {
                    throw new Error("Sequence not an array or object:", s);
                }
            });
        }
    }

    packageAndName(pkg, name) {
        if (pkg === "") {
            return name;
        } else if (pkg) {
            return `${pkg}/${name}`
        } else if (this.options.package) {
            return `${this.options.package}/${name}`
        } else {
            return name;
        }
    }

    namespacePackageAndName(pkg, name) {
        return `${this.wskProps.namespace}/${this.packageAndName(pkg, name)}`;
    }

    // To be valid the name has to not match an existing one
    actionNameIsValid(name, actionNames) {
        return name && !actionNames.includes(name);
    }

    getActionName(actionJson, pkgJson) {
        if (actionJson.action) {
            return actionJson.action;

        } else if (pkgJson && pkgJson.name) {
            // use package.json name as action name by default
            // turn "@adobe-internal-nui/worker-tika" into "worker-tika"
            return pkgJson.name.split('/').pop();
        }
    }

    /** Action name including package */
    getFullActionName(actionJson, pkgJson) {
        // prefix an openwhisk package name if specified in CLI arguments or actionJson
        return this.packageAndName( actionJson.package, this.getActionName(actionJson, pkgJson) );
    }

    getActionURL(actionJson, pkgJson) {
        const host = this.wskProps.apihost;
        const namespace = this.wskProps.namespace;
        const packageAndName = this.getFullActionName(actionJson, pkgJson);

        return `${host}/api/v1/namespaces/${namespace}/actions/${packageAndName}`;
    }

    getActionLimits(actionJson) {
        return {
            timeout: actionJson.timeout,
            memory: actionJson.memory,
            // Ensure the default concurrency for actions with a custom docker
            // container is 1. The reason is that most of these actions don't support
            // concurrent execution due to resource limits.
            concurrency: actionJson.concurrency || actionJson.docker ? 1 : undefined,
            logsize: actionJson.logsize
        };
    }

    handleEnvVar(value, location) {
        if (typeof value === "string" && value.startsWith("env:")) {
            const envVar = value.substring("env:".length)
            value = process.env[envVar];
            if (!value) {
                util.logTrackedWarning(`Environment variable not set: ${envVar}. Referenced in ${location}.`);
                return null;
            } else {
                return value;
            }
        } else {
            return value;
        }
    }

    getActionParameters(actionJson) {
        if (!actionJson.parameters) {
            return undefined;
        }

        if (typeof actionJson.parameters !== 'object') {
            throw new Error("'openwhisk.parameters' in the package.json must be an object.");
        }

        const parameters = {};
        Object.keys(actionJson.parameters).forEach(key => {
            const value = actionJson.parameters[key];
            parameters[key] = this.handleEnvVar(value, `default parameter '${key}'`);
        });

        return parameters;
    }

    getActionAnnotations(actionJson, pkgJson) {
        const annotations = {
            deployed_at: new Date().toISOString(),
            deployed_by: os.userInfo().username,
            deployed_from: os.hostname()
        };

        if (pkgJson) {
            if (pkgJson.description) {
                annotations.description = pkgJson.description;
            }
            if (pkgJson.version) {
                annotations.npm_version = pkgJson.version;
            }
        }

        // web actions
        if (actionJson.web && actionJson.web !== 'false' && actionJson.web !== false) {
            annotations["web-export"] = true;
            if (actionJson.web === 'raw') {
                annotations["raw-http"] = true;
            }
            if (actionJson.webSecure) {
                annotations["require-whisk-auth"] = this.handleEnvVar(actionJson.webSecure, `webSecure flag`);
            }
            if (actionJson.webCustomOptions) {
                annotations["web-custom-options"] = true;
            }
        }

        // final actions - default vs. invoke time parameters
        if (actionJson.final) {
            // eslint-disable-next-line dot-notation
            annotations["final"] = true;
        }

        return annotations;
    }

    // ----------------------< operations >--------------------------------

    async createPackage(pkgName) {
        pkgName = pkgName || this.options.package;
        if (!pkgName) {
            return;
        }

        try {
            const pkg = await this.wsk.packages.get({name: pkgName});
            util.log("Existing OpenWhisk package:", pkg.name);

        } catch (getError) {
            // upon 404 or other error, we assume it's missing and try to create it
            try {
                const pkg = await this.wsk.packages.create({name: pkgName});

                util.log("Created OpenWhisk package:", pkg.name);
            } catch (createError) {
                util.logError("Could not create OpenWhisk package:", createError);
                process.exit(1);
            }
        }
    }

    // passing through 'serverless' instead of a require() to avoid circular require loop
    async packageAction(sourcePath, serverless) {
        await serverless.run('package', {
            cwd: sourcePath,
            pkg: this.options.package,
            verbose: this.options.verbose,
            insecure: this.options.insecure,
            prod: this.options.production
        });

        const zipPath = path.resolve(sourcePath, ".serverless/action.zip");
        if (!fse.existsSync(zipPath)) {
            throw `'serverless package' has not produced a zip file at ${zipPath}`;
        }
        return zipPath;
    }

    getZipSize(zipPath) {
        return prettyBytes(fse.statSync(zipPath).size);
    }

    logZip(zipPath) {
        console.log("Action zip size: " + this.getZipSize(zipPath));
        new Zip(zipPath).getEntries().sort((a,b) =>  a.header.size - b.header.size).forEach(entry => {
            console.log(" - " + entry.entryName + (entry.isDirectory ? "" : " [" + prettyBytes(entry.header.size) + "]"));
        });
    }

    dockerImageExists(docker) {
        // Check whether we have already checked this docker image
        const exists = this.dockerImages[docker];
        if (exists === true) {
            return true;
        } else if (exists === false) {
            return false;
        }

        // We have not checked this docker image before so go ahead and check
        const command = `DOCKER_CLI_EXPERIMENTAL=enabled docker manifest inspect ${docker} > /dev/null`;
        try {
            execSync(command);
            this.dockerImages[docker] = true;
            return true;
        } catch (error) {
            this.dockerImages[docker] = false;
            return false;
        }
    }

    async deploy(actionJson, packageJson, exec) {
        const action = {
            name: this.getFullActionName(actionJson, packageJson),
            action: {
                exec: exec,
                limits: this.getActionLimits(actionJson),
                parameters: objectToKVArray(this.getActionParameters(actionJson)),
                annotations: objectToKVArray(this.getActionAnnotations(actionJson, packageJson))
            }
        };

        if (this.options.verbose) {
            const type = (action.action.exec && action.action.exec.kind === "sequence") ? "sequence" : "action";
            util.log((this.options.dryRun ? 'Would deploy following ' : 'Deploying ') + `${type}:`);
            logAction(action);
        }

        if (this.options.dryRun) {
            return;
        }

        await this.wsk.actions.update(action);
    }

    async deployActionZip(actionJson, packageJson, zipPath) {
        await this.deploy(actionJson, packageJson, {
            main: "main",
            kind: actionJson.docker ? 'blackbox' : actionJson.kind || DEFAULT_KIND,
            image: actionJson.docker,
            code: fse.readFileSync(zipPath).toString('base64')
        });
    }

    async deployActionSequence(sequence, packageJson) {
        // prefix namespace and ow package to component action names
        const components = sequence.components.map(
            name => this.namespacePackageAndName(sequence.package, name)
        );

        await this.deploy(sequence, packageJson, {
            kind: 'sequence',
            components: components
        });
    }

    async deployVariants(actionJson, packageJson, zipPath) {
        const modul = packageJson.name;

        // Verify that variants is an array
        if (!Array.isArray(actionJson.variants)) {
            throw new Error(`variants section in ${modul} is not an array.  No variants will be deployed`);
        }

        const actionNames = [this.getActionName(actionJson, packageJson)];
        const variantNames = [];

        for (const variant of actionJson.variants) {
            if (this.actionNameIsValid(variant.action, actionNames)) {
                actionNames.push(variant.action);
                variantNames.push(variant.action);

                // Settings in variant override any set in actionJson
                const variantActionJson = Object.assign({}, actionJson, variant);
                await this.deployActionZip(variantActionJson, packageJson, zipPath);
            } else {
                throw new Error(`action name ${variant.action} from ${modul} not being deployed because the name is either undefined or not unique`);
            }
        }
        return variantNames;
    }

    // -----------------------------< high level operations >------------------

    async deployModule(dir, ctx, serverless) {
        const packageJson = util.packageJson(dir);
        const modul = packageJson.name;
        const actionJson = packageJson.openwhisk || {};

        const timer = `${modul} took`;
        console.time(timer);

        util.log(this.options.dryRun ? 'packaging' : 'deploying', modul, "...");

        // overwrite any action settings defined in an aggregate package.json for this module
        if (ctx.mainPkgJson &&
            ctx.mainPkgJson.openwhisk &&
            ctx.mainPkgJson.openwhisk.actions &&
            ctx.mainPkgJson.openwhisk.actions[modul]) {
            const overwrite = ctx.mainPkgJson.openwhisk.actions[modul];

            actionJson.action = overwrite.action || actionJson.action;
            // allow overwrite.package to be set to empty string and use that
            actionJson.package = overwrite.package !== undefined ? overwrite.package : actionJson.package;
            actionJson.limits = Object.assign(actionJson.limits || {}, overwrite.limits);
            actionJson.parameters = Object.assign(actionJson.parameters || {}, overwrite.parameters);
            if (overwrite.variants) {
                // convert variants to dictionaries first
                const variants = actionJson.variants ? actionJson.variants.reduce((o, v) => { o[v.action] = v; return o; }, {}) : {};
                const overwriteVariants = overwrite.variants.reduce((o, v) => { o[v.action] = v; return o; }, {});
                // overwrite/merge and back to array
                actionJson.variants = Object.values( Object.assign(variants, overwriteVariants) );
            }
        }

        const result = {
            "state": ""
        };
        // allow actionJson.package to be empty string und use that
        result["package"] = actionJson.package !== undefined ? actionJson.package : (this.options.package || null);
        result["action"] = "";

        if (modul.includes('/')) {
            const depSplit = modul.split('/', 2);
            if (depSplit[0] === "@adobe-internal-nui") {
                result["npm scope"] = "<nui>";
            } else {
                result["npm scope"] = depSplit[0];
            }
            result["npm package"] = depSplit[1];
        } else {
            result["npm package"] = modul;
        }

        result["web?"] = "";
        if (packageJson.openwhisk && packageJson.openwhisk.web) {
            result["web?"] = packageJson.openwhisk.web === true ? "web" : packageJson.openwhisk.web;
        }
        result["version"] = util.isLinked(dir) ? `local npm link (${packageJson.version})` : packageJson.version;

        try {
            // look for zip in the module directory
            let zipPath = path.resolve(dir, "action.zip");
            const alreadyPackaged = fse.existsSync(zipPath);

            if (!alreadyPackaged) {
                console.log("creating action.zip...");

                zipPath = await this.packageAction(dir, serverless);

            } else {
                // log information about the zip
                this.logZip(zipPath);
            }

            result["size"] = this.getZipSize(zipPath);
            const actionName = this.getActionName(actionJson, packageJson)
            if (ctx.npm2Action) {
                ctx.npm2Action[modul] = actionName;
            }
            result["action"] = actionName;

            // Check that docker image is in artifactory if needed
            const docker = actionJson.docker;
            if (docker && ! this.options.disableDockerCheck) {
                if (! this.dockerImageExists(docker)) {
                    throw new Error(`Can't find docker image ${docker} in artifactory`);
                }
            }

            await this.deployActionZip(actionJson, packageJson, zipPath);

            // If there are variants we need to deploy them, too.
            if (actionJson.variants) {
                const variantNames = await this.deployVariants(actionJson, packageJson, zipPath);

                result["variants"] = variantNames.join(",");
            }

            if (util.hasWarnings()) {
                trackWarning(ctx, result);
            } else {
                result["state"] = this.options.dryRun ? (alreadyPackaged ? '✔ zip' : '✔ packaged') : '✔ deployed';
            }
        } catch (e) {
            trackFailure(ctx, result, e, this.options.verbose);
        }

        console.timeEnd(timer);
        util.log();

        return result;
    }

    async deploySequence(sequence, ctx) {
        const timer = `${sequence.action} took`;
        console.time(timer);

        util.log(this.options.dryRun ? 'packaging sequence' : 'deploying sequence', `'${sequence.action}'...`);

        const result = {
            "state": ""
        };
        // allow sequence.package to be empty string und use that
        result["package"] = sequence.package !== undefined ? sequence.package : (this.options.package || null);
        result["sequence"] = sequence.action;

        // map from npm names to action names
        sequence.components = sequence.components.map(modul => {
            if (!ctx.npm2Action[modul]) {
                throw new Error(`Sequence component is not a dependency: ${modul}`);
            }
            return ctx.npm2Action[modul];
        });

        try {
            await this.deployActionSequence(sequence, ctx.mainPkgJson);

            if (util.hasWarnings()) {
                trackWarning(ctx, result);
            } else {
                result["state"] = this.options.dryRun ? '✔ packaged' : '✔ deployed';
            }

        } catch (e) {
            trackFailure(ctx, result, e, this.options.verbose);
        }

        console.timeEnd(timer);
        util.log();

        return result;
    }

}

// transforms a JS object into an array with {key, value} objects
function objectToKVArray(obj) {
    return Object.keys(obj || {}).map(key => ({ key, value: obj[key] }));
}

function truncate(str, maxLength, ellipsis="...") {
    return str.replace(new RegExp("^(.{" + maxLength + "}).{2,}"), `$1${ellipsis} (${str.length} chars)`);
}

function logAction(action) {
    // filter out any long `code` string to avoid printing thousands of lines on the terminal
    if (action && action.action && action.action.exec && action.action.exec.code) {
        action = JSON.parse(JSON.stringify(action));
        action.action.exec.code = truncate(action.action.exec.code, 50);
    }
    console.dir(action, { depth: null });
}

function trackWarning(ctx, row) {
    ctx.warnings = true;

    row["state"] = '! warning';
    // print warning rows in yellow
    Object.keys(row).forEach(key => row[key] = yellow(row[key]));

    util.resetWarnings();
}

function trackFailure(ctx, row, e, verbose) {
    ctx.failures = true;

    row["state"] = '✖ failed';
    // print error rows in red
    Object.keys(row).forEach(key => row[key] = red(row[key]));

    util.logError(e.message);
    if (verbose) {
        console.log(e);
    }
    util.log();
}

module.exports = OpenWhisk;
