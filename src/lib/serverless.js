/**
 *  ADOBE CONFIDENTIAL
 *  __________________
 *
 *  Copyright 2018 Adobe Systems Incorporated
 *  All Rights Reserved.
 *
 *  NOTICE:  All information contained herein is, and remains
 *  the property of Adobe Systems Incorporated and its suppliers,
 *  if any.  The intellectual and technical concepts contained
 *  herein are proprietary to Adobe Systems Incorporated and its
 *  suppliers and are protected by trade secret or copyright law.
 *  Dissemination of this information or reproduction of this material
 *  is strictly forbidden unless prior written permission is obtained
 *  from Adobe Systems Incorporated.
 */

'use strict';

const FUNCTION_NAME = 'action';

module.exports = {
    run,
    invokeLocal,
    FUNCTION_NAME
};

const SERVERLESS_YML = 'serverless.yml';
const DEFAULT_ACTION_FILENAMES = [
    "action.js", "worker.js", "worker.sh"
];

const INVOKE_LOCAL_RESULT_FILE = ".serverless/invoke-local-result.json";

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const write = require('write');
const util = require('./util');
const Module = require('module');
const shellParse = require('shell-quote').parse;
const { execSync } = require('child_process');
const OpenWhisk = require('./openwhisk');

function removeUndefined(obj) {
    Object.keys(obj).forEach(key => {
      if (obj[key] && typeof obj[key] === 'object') {
        removeUndefined(obj[key]);

      } else if (obj[key] === undefined) {
          delete obj[key];
      }
    });
    return obj;
}

function findSource(pkg) {
    // lookup source file based on package main...
    let file = pkg.main;
    if (!file) {
        // ...or default filenames (like action.js) if exists
        file = DEFAULT_ACTION_FILENAMES.find(fs.existsSync);
        if (!file) {
            return undefined;
        }
    }
    const fileInfo = path.parse(file);
    // shell script action keep file name as is (for serverless-nui plugin)
    if (fileInfo.ext === ".sh") {
        return file;
    } else {
        // exported js function must be called "main"
        // serverless itself validates this before webpack happens, so it must point
        // to the filename, not the index.js (using index.main) that we get with webpack
        return `${fileInfo.name}.main`;
    }
}

function createYaml(options) {
    // use existing one if present and tracked by git
    if (fs.existsSync(SERVERLESS_YML)) {
        try {
            util.system(`git ls-files --error-unmatch ${SERVERLESS_YML}`, {stdio: 'ignore'});

            // if successful, git tracks the file, so the user must have added it deliberately
            util.logWarn("Existing serverless.yml found, tracked by git, not overwriting. Are you sure that's right?");
            return;
        } catch (e) {
            // errors if file is not tracked by git, which means it's like
            if (options.verbose) {
                util.log("Note: overwriting existing serverless.yml which might be a leftover from a previous nui execution that failed.");
            }
        }
    }

    const pkg = util.packageJson();
    const ow = pkg.openwhisk || {};

    if (options.verbose) {
        util.log();
        util.log("openwhisk config from package.json:");
        util.log();
        console.dir(ow);
        util.log();
    }

    if (!ow.source) {
        ow.source = findSource(pkg);
    }

    if (!ow.source) {
        util.logError("no action source found");
        util.logError(`no 'openwhisk.source', 'main' or any of these files found: ${DEFAULT_ACTION_FILENAMES.join(", ")}`);
        process.exit(1);
    }

    // prefix an openwhisk package name if specified in CLI arguments
    if (options.pkg) {
        ow.package = options.pkg;
    }

    const openwhisk = new OpenWhisk({
        package: options.pkg,
        verbose: options.verbose,
        ignoreCerts: options.insecure
    });
    ow.action = openwhisk.getFullActionName(ow, pkg);

    const yml = {
        service: pkg.name,
        provider: {
            name: "openwhisk",
            runtime: ow.kind || "nodejs:10",
            disableAutoExternals: ow.packageAllDependencies
        },
        plugins: [
            "@nui/serverless-nui",
            "serverless-openwhisk",
            "serverless-webpack"
        ],
        package: {
            individually: true
        },
        functions: {}
    };

    const parameters = openwhisk.getActionParameters(ow);

    // Note: this function name defines the zip file name action.zip
    // with multiple actions in one package.json, each must be described
    // in openwhisk: {} and have a unique name here
    const action = yml.functions[FUNCTION_NAME] = {
        handler: ow.source,
        name: ow.action,
        parameters: parameters,
        annotations: openwhisk.getActionAnnotations(ow, pkg),
        ...openwhisk.getActionLimits(ow)
    };

    if (action.timeout) {
        // serverless.yml timeout is in seconds
        action.timeout = Math.round(action.timeout / 1000);
    }

    // optional settings

    // ignore ssl cert for local openwhisk deployment
    if (options.insecure) {
        yml.provider.ignore_certs = true;
    }

    // custom docker image (runtime)
    if (ow.docker) {
        action.image = ow.docker;
    }

    // write yaml
    write.sync(SERVERLESS_YML,
`# NOTE: This file is AUTOMATICALLY GENERATED by the nui tool and is expected to be
#       automatically removed upon exit, which apparently did not happen.
#
#       You can safely delete it.
#
#       This file will be regenerated based on settings in package.json.
#       It must not be checked into source control.
#
# Date: ${new Date()}
# Host: ${execSync('hostname').toString().trim()}
#
` +
        yaml.dump(removeUndefined(yml), {indent: 2, skipInvalid: false, flowLevel: -1})
    );

    if (options.verbose) {
        util.log("serverless.yml:");
        util.log();
        util.system("cat serverless.yml");
        util.log();
    }

    // make sure it gets deleted on exit
    const fileToRemove = path.resolve(SERVERLESS_YML);
    process.on('exit', function() {
        try {
            fs.unlinkSync(fileToRemove);
        } catch (ignore) {}
    });
}

const ansiPattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
].join('|');

const ansiRegex = new RegExp(ansiPattern, 'g');

function stripAnsi(str) {
    return str.replace(ansiRegex, "");
}

function filterServerlessNuiLogMessages(logFn) {
    return function(msg) {
        // only log the messages from our serverless-nui plugin
        if (msg && typeof(msg) === 'string' && msg.includes("[serverless-nui]")) {
            // and remove ansi formatting & the prefix
            logFn(stripAnsi(msg).replace("Serverless: [serverless-nui] ", ""));
        }
    };
}

// find serverless module
function findServerlessModulePath(modulePath) {
    const NODE_MODULES = 'node_modules';
    const NUI_SERVERLESS_NUI = NODE_MODULES + '/@nui/serverless-nui';
    let p = modulePath;
    while (path.dirname(p) !== p) {
        if (fs.existsSync(`${p}/${NUI_SERVERLESS_NUI}`)) {
            return path.resolve(p, NODE_MODULES);
        }
        p = path.dirname(p);
    }
    throw Error(`Unable to find ${NUI_SERVERLESS_NUI} in ${modulePath}`);
}

// call serverless as node module
function runServerlessEmbedded(args) {
    return new Promise((resolve, reject) => {
        // use our bundled serverless & plugins
        const modulePath = findServerlessModulePath(__dirname);

        // hack to get serverless to lookup plugins in our cli modulePath as well
        const old_nodeModulePaths = Module._nodeModulePaths;
        Module._nodeModulePaths = function(from) {
            const paths = old_nodeModulePaths.call(this, from); // call the original method
            paths.unshift(modulePath);
            return paths;
        }

        // serverless has no fully quiet mode, so overwrite the console.log() unless we are in verbose mode
        const standardConsoleLog = console.log;
        if (!args.includes("--verbose")) {
            console.log = filterServerlessNuiLogMessages(standardConsoleLog);
        }

        // overwrite cli args, as Serverless has no way of passing it otherwise
        process.argv = ["node", "serverless"].concat(shellParse(args));

        const Serverless = require('serverless/lib/Serverless');
        const sls = new Serverless();
        sls.init()
            .then(() => sls.run())
            .then(() => resolve())
            .catch((err) => reject(err))
            .finally(() => {
                // restore normal module paths
                Module._nodeModulePaths = old_nodeModulePaths;
                // restore full logging
                console.log = standardConsoleLog;
            });
    });
}

// invoke serverless via cli
// not preferred, just keeping as potential option.
// this approach does not give us good error handling since Serverless cli prints its own
// noisy error report which can be misleading with the stacktrace of the serverless plugins
function runServerlessExternalProcess(args) {
    return new Promise((resolve, reject) => {
        util.log("running serverless as external process");
        try {
            // use our bundled serverless & plugins
            const modulePath = `${__dirname}/../node_modules`;
            const serverlessCmd = `${modulePath}/serverless/bin/serverless`;

            util.system(`NODE_PATH="${modulePath}" "${serverlessCmd}" ${args}`);

            return resolve();

        } catch (err) {
            return reject(err);
        }
    });
}

function run(args, options) {
    options = options || {};

    // change working directory to service directory if specified as cwd
    let oldCwd;
    if (options.cwd) {
        oldCwd = process.cwd();
        process.chdir(options.cwd);
    }

    if (!options.noYaml) {
        // create serverless.yml if it does not exist yet
        createYaml(options);
    }

    if (options.verbose) {
        args += ' --verbose';
        util.log(`running 'serverless ${args}' ...`);
    }

    if (options.prod) {
        args += ' --mode production';
        util.log("generating smaller javascript");
    }
    const serverless = options.cli ?
        runServerlessExternalProcess(args) :
        runServerlessEmbedded(args);

    let sls = serverless
        .then(() => {
            if (options.verbose) {
                util.log("serverless completed successfully.");
            }
        })
        .finally(() => {
            // restore previous working directory
            if (oldCwd) {
                process.chdir(oldCwd);
            }
        });

    if (options.handleError) {
        sls = sls.catch(e => {
            if (options.verbose) {
                util.logError(e);
            } else {
                util.logError(e.message || e);
            }
            process.exit(2);
        });
    }
    return sls;
}

/**
 *
 * @param {*} opts
 *   start  - boolean: if true just start the container,
 *   stop   - boolean: if true just stop existing container,
 *   name   - string: optional unique name for the container,
 *   inDir  - path: directory to mount as /in inside the container,
 *   outDir - path: directory to mount as /out inside the container,
 *   params - object: json parameters for the action invocation
 */
function invokeLocal(opts) {

    let cmd = `invoke local -f ${FUNCTION_NAME}`;
    let dockerArgs = ` --dockerArgs='`;

    if (opts.start) {
        cmd += " --start";
    } else if (opts.stop) {
        cmd += " --stop";
    }

    if (opts.name) {
        cmd += ` --name '${opts.name}'`;
    }

    if (opts.dockerArgs) {
        const escapedDockerArgs = util.shellEscapeEqualSign(util.shellEscapeSingleQuotes(opts.dockerArgs) );
        dockerArgs += escapedDockerArgs;
    }

    // mount dirs
    if (opts.inDir || opts.outDir) {
        if (opts.inDir) {
            // input is read-only
            dockerArgs += ` -v ${opts.inDir}:/in:ro`;
        }
        if (opts.outDir) {
            // output must be writeable (default docker mount behavior)
            dockerArgs += ` -v ${opts.outDir}:/out`;
        }
    }
    cmd += `${dockerArgs}'`;

    if (opts.params) {
        const data = util.shellEscapeSingleQuotes( JSON.stringify(opts.params) );
        cmd += ` --data '${data}'`;
    }
    return run(cmd, {verbose: opts.verbose})
        .then(() => {
            util.log();
            if (fs.existsSync(INVOKE_LOCAL_RESULT_FILE)) {
                try {
                    return JSON.parse(fs.readFileSync(INVOKE_LOCAL_RESULT_FILE));
                } catch (e) {
                    console.log(`Warning: could not parse ${INVOKE_LOCAL_RESULT_FILE} with action result from serverless invoke-local:`, e);
                    return undefined;
                } finally {
                    try {
                        fs.unlinkSync(INVOKE_LOCAL_RESULT_FILE);
                    } catch (ignore) {
                    }
                }
            } else {
                return undefined;
            }
        });
}
