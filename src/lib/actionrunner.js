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

const util = require('util');
const sleep = require('util').promisify(setTimeout);
const child_process = require('child_process');
const exec = util.promisify(child_process.exec);
const spawn = child_process.spawn;
const debug = require('debug')('aio-asset-compute.actionrunner');
const request = require('requestretry');

const OPENWHISK_DEFAULTS = {

    // https://github.com/apache/openwhisk-wskdeploy/blob/master/specification/html/spec_actions.md#valid-limit-keys
    timeoutMsec: 60000,
    memoryLimitMB: 256,

    defaultKind: "nodejs:10",

    // https://github.com/apache/incubator-openwhisk/blob/master/ansible/files/runtimes.json
    // note: openwhisk deployments might have their own versions
    kinds: {
        // "nodejs"     : "openwhisk/nodejsaction:latest", // deprecated, image no longer available
        // "nodejs:6"   : "openwhisk/nodejs6action:latest",
        // "nodejs:8"   : "openwhisk/action-nodejs-v8:latest",
        "nodejs:10"  : "adobeapiplatform/adobe-action-nodejs-v10:3.0.27", // see: https://hub.docker.com/r/adobeapiplatform/adobe-action-nodejs-v10/tags
        "nodejs:12"  : "adobeapiplatform/adobe-action-nodejs-v12:3.0.27", // see: https://hub.docker.com/r/adobeapiplatform/adobe-action-nodejs-v12/tags
        "nodejs:14"  : "adobeapiplatform/adobe-action-nodejs-v14:3.0.27", // see: https://hub.docker.com/r/adobeapiplatform/adobe-action-nodejs-v14/tags
        // "python"     : "openwhisk/python2action:latest",
        // "python:2"   : "openwhisk/python2action:latest",
        // "python:3"   : "openwhisk/python3action:latest",
        // "swift"      : "openwhisk/swiftaction:latest", // deprecated, image no longer available
        // "swift:3"    : "openwhisk/swift3action:latest",   // deprecated, but still available
        // "swift:3.1.1": "openwhisk/action-swift-v3.1.1:latest",
        // "swift:4.1"  : "openwhisk/action-swift-v4.1:latest",
        // "java"       : "openwhisk/java8action:latest",
        // "php:7.1"    : "openwhisk/action-php-v7.1:latest",
        // "php:7.2"    : "openwhisk/action-php-v7.2:latest",
        // "native"     : "openwhisk/dockerskeleton:latest",
    }
};

// openwhisk action runtime: https://github.com/apache/openwhisk/blob/master/docs/actions-new.md
const RUNTIME_PORT = 8080;

// retry delay for action /init
const RETRY_DELAY_MS = 100;

function safeContainerName(name) {
    // docker container names are restricted to [a-zA-Z0-9][a-zA-Z0-9_.-]*

    // 1. replace special characters with dash
    name = name.replace(/[^a-zA-Z0-9_.-]+/g, '-');
    // 2. leading character is more limited
    name = name.replace(/^[^a-zA-Z0-9]+/g, '');
    // 3. (nice to have) remove trailing special chars
    name = name.replace(/[^a-zA-Z0-9]+$/g, '');

    return name;
}

function prettyJson(json) {
    return JSON.stringify(json, null, 4);
}

// TODO: share with wskdebug, use dockerrode, use fetch()
/**
 * Allows to run a single openwhisk action using a local docker container.
 */
class OpenwhiskActionRunner {

    constructor(options={}) {
        this.action = Object.assign({
            name: "action",
            exec: {},
            limits: {},
            parameters: [],
            annotations: []
        }, options.action);

        if (!this.action.exec || !this.action.exec.code) {
            throw new Error("Missing action code");
        }

        this.action.limits.timeout = this.action.limits.timeout || OPENWHISK_DEFAULTS.timeoutMsec;
        this.action.limits.memory = this.action.limits.memory || OPENWHISK_DEFAULTS.memoryLimitMB;

        debug("action:", { ...this.action, exec: {...this.action.exec, code: `(data ${this.action.exec.code.length} bytes)` } });

        this.containerName = safeContainerName(options.containerName || `OpenwhiskActionRunner-${this.action.name}`);

        this.env = Object.assign({
            DEBUG: process.env.WORKER_DEBUG
        }, options.env);

        this.mounts = options.mounts;
    }

    async start() {
        debug("start()");
        await this._startContainer();

        try {
            await this._initAction();
        } catch (e) {
            // shut down if we can't init
            await this.stop();
            throw e;
        }
    }

    async run(params) {
        debug("run()");
        return this._runAction(params);
    }

    async stop() {
        debug("stop()");
        if (this.containerId) {
            await this._removeContainer(this.containerId);
            debug("stopped container", this.containerId);

            delete this.containerId;
        }
    }

    getContainerName() {
        return this.containerName;
    }

    // -------------------------------< internal >--------------------------

    async _startContainer() {
        // make sure a left over container (same name) is removed
        await this._removeContainer(this.containerName);

        const memoryBytes = this.action.limits.memory * 1024 * 1024;

        let customEnvVars = "";
        if (this.env) {
            for (const key of Object.keys(this.env)) {
                customEnvVars += `-e ${key}='${this.env[key]}' `;
            }
        }

        let mounts = "";
        if (this.mounts) {
            for (const key of Object.keys(this.mounts)) {
                mounts += `-v '${key}:${this.mounts[key]}' `;
            }
        }

        // for when we run inside a docker container, use the DOCKER_HOST_IP if available
        const port = process.env.DOCKER_HOST_IP ? `${process.env.DOCKER_HOST_IP.trim()}::${RUNTIME_PORT}` : RUNTIME_PORT;

        this.containerId = await this._docker(
            `run -d
                --rm
                --name "${this.containerName}"
                --bind 0.0.0.0
                -p ${port}
                -m ${memoryBytes}
                ${customEnvVars}
                ${mounts}
                ${this._getImage()}`
        );

        const portOutput = await this._docker(`port ${this.containerId} ${RUNTIME_PORT}`);
        this.containerHost = portOutput.split('\n', 1)[0];
        if (this.containerHost === "0.0.0.0") {
            this.containerHost = "127.0.0.1";
            debug("IP address provided was 0.0.0.0 (all hosts), using 127.0.0.1");
        }

        debug(`started container, id: ${this.containerId} host: ${this.containerHost}`);
    }

    async _initAction() {
        const url = `http://${this.containerHost}/init`;
        debug(`initializing action: POST ${url}`);

        try {
            const response = await request.post({
                url: url,
                json: {
                    value: {
                        binary: this.action.exec.binary,
                        main: this.action.exec.main || "main",
                        code: this.action.exec.code,
                    }
                },

                fullResponse: true,

                maxAttempts: this.action.limits.timeout / RETRY_DELAY_MS,
                retryDelay: RETRY_DELAY_MS,

                retryStrategy: (err, response, body) => {
                    const errStr = err ? JSON.stringify(err) : "No error message";
                    const responseStr = response ? JSON.stringify(response) : "No response object";
                    const bodyStr = body ? JSON.stringify(body) : "No body";
                    debug(`retrying /init: err:${errStr}; response:${responseStr}; body:${bodyStr}`);
                    return request.RetryStrategies.NetworkError(err, response, body);
                }
            });

            const body = response.body;
            if (!body) {
                throw new Error(`responded with error: ${response.statusCode}`);
            }
            if (body.OK !== true) {
                throw new Error(`responded with error: ${body.error || prettyJson(body)}`);
            }

            debug('action ready');
            return body;

        } catch (e) {
            await this._docker(`logs -t ${this.containerId}`);

            throw new Error(`Could not init action on container (POST ${url}: ${e.message}`);
        }
    }

    async _runAction(params) {
        const procDockerLogs = this._dockerSpawn(`logs -t -f --since 0m ${this.containerId}`);

        // wait a bit to get docker logs to attach - otherwise we typically loose log output
        // better solution: switch to dockerode which gives more stable logs via socket streaming
        // see https://github.com/apache/openwhisk-wskdebug/blob/f829f91d8e074d0640dbdbe3b78e0b2eca7c2de7/src/invoker.js#L360-L378
        await sleep(process.env.AIO_ASSET_COMPUTE_LOG_DELAY || 100);

        debug(`invoking action '${this.action.name}': POST http://${this.containerHost}/run (timeout ${this.action.limits.timeout/1000} seconds)`);
        debug(prettyJson(params));

        let response;
        try {
            response = await request.post({
                url: `http://${this.containerHost}/run`,
                maxAttempts: 1,
                timeout: this.action.limits.timeout,
                json: {
                    value: params,

                    action_name     : this.action.name,
                    activation_id   : (new Date()).getTime().toString(36),
                    deadline        : `${Date.now() + this.action.limits.timeout}`,

                    // providing dummy values below - even if it does not work - makes the openwhisk() library
                    // load without an exception and only fail later upon actual invocations, which are not supported anyway
                    // this approach supports more cases where actions in a test mode might not invoke other actions
                    api_host        : "local",
                    api_key         : "local",
                    namespace       : "local",
                    allow_concurrent: "true"
                }
            });

        } catch (e) {
            if (e.code === 'ESOCKETTIMEDOUT') {
                throw new Error(`action '${this.action.name}' timed out after ${this.action.limits.timeout/1000} seconds`);
            } else {
                throw new Error(`'${this.action.name}' invocation failed due to a system error: ${e.message}`);
            }

        } finally {
            procDockerLogs.kill();
        }

        const body = response.body;
        debug(`activation result (statusCode: ${response.statusCode}):`, prettyJson(body));

        if (response.statusCode === 200 && body) {
            // successful activation
            return body;

        } else {
            // failed activation
            let msg = `'${this.action.name}' invocation failed: `;
            if (body && body.error) {
                msg = msg + prettyJson(body.error);
            } else {
                msg = msg + "(returned empty result)";
            }
            const err = new Error(msg);
            err.statusCode = response.statusCode;
            if (body && body.error) {
                err.actionError = body.error;
            }
            throw err;
        }
    }

    _getImage() {
        // blackbox -> image is specified directly
        if (this.action.exec.image) {
            return this.action.exec.image;
        }

        // kind -> lookup image
        const kind = this.action.exec.kind || OPENWHISK_DEFAULTS.defaultKind;

        // remove :default suffix if present
        const kind2 = kind.replace(/:default$/, '');

        const image = OPENWHISK_DEFAULTS.kinds[kind2];

        if (!image) {
            throw new Error(`Unsupported kind: ${kind}`);
        }

        return image;
    }

    async _removeContainer(nameOrId) {
        try {
            await this._docker(`rm -f ${nameOrId}`, {stdio: 'ignore'});
        } catch (ignore) { // eslint-disable-line no-unused-vars
            // debug("ignored exception", ignore);
        }
    }

    async _docker(args, opts) {
        args = args.replace(/\s+/g, ' ');
        debug("> docker " + args);
        const { stdout } = await exec("docker " + args, opts);
        if (stdout) {
            return stdout.toString().trim();
        } else {
            return '';
        }
    }

    _dockerSpawn(args) {
        debug("> docker " + args);

        const proc = spawn('docker', args.split(' '));

        proc.stdout.on('data', function(data) {
            process.stdout.write(data.toString());
        });
        proc.stderr.on('data', function(data) {
            process.stderr.write(data.toString());
        });

        const kill = proc.kill;
        proc.kill = function() {
            // ensure logging stops immediately
            proc.stdout.removeAllListeners("data");
            proc.stderr.removeAllListeners("data");
            kill.apply(proc);
        };

        return proc;
    }
}

module.exports = OpenwhiskActionRunner;
