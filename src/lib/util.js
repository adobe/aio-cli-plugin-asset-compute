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

'use strict';

const fse = require('fs-extra');
const path = require('path');
const rimraf = require('rimraf');
const { execSync } = require('child_process');
const { red, yellow } = require('chalk');
const util = require('util');
const Console = console.Console;
const semver = require('semver');

// for redirectOutputToLogFile()
let originalStdOut, originalStdErr, outFile;

// singleton to track warnings
let hasWarnings = false;

const latestModuleVersions = {};

const NUI_LIBRARY_OLD = "@adobe-internal-nui/library";
const NUI_LIBRARY = "@nui/library";

function logError(...msg) {
  console.log("🚨", red("error:"), red(...msg));
}

module.exports = {
  system: function (args, options) {
    options = options || {};
    if (!options.stdio) {
      options.stdio = this.getOutputStdio();
    }
    return execSync(args, options);
  },

  systemStdout: function (args, options) {
    options = options || {};
    options.stdio = 'pipe';
    const buffer = this.system(args, options);
    if (buffer) {
      return buffer.toString().trim();
    } else {
      return buffer;
    }
  },

  packageJson: function (dir = `${process.cwd()}`) {
    const pkgFile = `${dir}/package.json`;

    if (!fse.existsSync(pkgFile)) {
      logError(`No package.json found in ${dir}`);
      process.exit(1);
    }

    // require caches, so we need to clone the resulting object
    // to avoid unintentionally sharing objects
    return JSON.parse(JSON.stringify(require(pkgFile)));
  },

  log: function (...msg) {
    if (msg.length === 0) {
      console.log();
    } else {
      console.log("🌸", ...msg);
    }
  },

  logWarn: function (...msg) {
    console.log("🚧", yellow("warning:"), yellow(...msg));
  },

  logError: logError,

  shellEscapeSingleQuotes: function (str) {
    // ' must be escaped as '\'' for shell arguments
    return str.replace(/'/g, "'\\''");
  },
  shellEscapeEqualSign: function (str) {
    // ' must be escaped as '\'' for shell arguments
    return str.replace(/=/g, "⏸");  // serverless cli still parses escaped equal signs so we must use a symbol
  },

  dotNui: function (...p) {
    return path.resolve('.nui', ...p);
  },

  // create temporary hidden folder for in & out dirs to mount
  prepareInOutDir: function () {
    const uniqueName = (process.env.BUILD_TAG || new Date().toISOString()).replace(/[^a-zA-Z0-9_]/g, '_');
    const dirs = {
      dotNui: this.dotNui(),
      work: this.dotNui(uniqueName),
      in: this.dotNui(uniqueName, 'in'),
      out: this.dotNui(uniqueName, 'out'),
      failed: this.dotNui(uniqueName, 'failed'),
      mock_crt: this.dotNui(uniqueName, 'mock-crt')
    }
    fse.ensureDirSync(dirs.in);
    // ensure readable by mounted docker container by giving everyone read
    fse.chmodSync(dirs.in, 0o755);
    fse.ensureDirSync(dirs.out);
    // ensure writeable by mounted docker container by giving everyone read+write
    fse.chmodSync(dirs.out, 0o777);
    fse.ensureDirSync(dirs.failed);
    // ensure writeable by mounted docker container by giving everyone read+write
    fse.chmodSync(dirs.failed, 0o777);
    // mock certificate directory
    fse.ensureDirSync(dirs.mock_crt);
    // ensure readable by mounted docker container by giving everyone read
    fse.chmodSync(dirs.mock_crt, 0o755);
    return dirs;
  },

  // remove temporary .nui/in + out dirs and failed if empty
  cleanupInOutDir: function (dirs) {
    fse.removeSync(dirs.in);
    fse.removeSync(dirs.out);
    fse.removeSync(dirs.mock_crt);
    if (fse.readdirSync(dirs.failed).length === 0) {
      fse.removeSync(dirs.failed);
    }
    if (fse.readdirSync(dirs.work).length === 0) {
      fse.removeSync(dirs.work);
    }

    // remove .nui if empty and unused otherwise
    if (fse.readdirSync(dirs.dotNui).length === 0) {
      fse.removeSync(dirs.dotNui);
    }
  },

  emptyInOutDir: function (dirs) {
    rimraf.sync(`${dirs.in}/*`);
    rimraf.sync(`${dirs.out}/*`);
  },

  // yargs extension, to use in a command visit function
  // automatically put all command options into their own "group"
  // separate from "Global Options:" like -v or -h
  yargsGroupCommandOptions: function (cmd, group) {
    if (cmd.builder) {
      const builder = cmd.builder;
      cmd.builder = yargs => {
        // existing options are the global ones
        const globalOpts = Object.keys(yargs.getOptions().key);

        // add command options
        builder(yargs);

        // now get all options including the ones from this command
        const allOpts = Object.keys(yargs.getOptions().key);
        // get options or positional args that are already in custom groups
        const otherGroupOpts = Object.values(yargs.getGroups()).reduce((array, group) => array.concat(group), []);

        // we only get _all_ options/args in one list here so we have to remove
        // the global options (catched above) and the options already in other groups
        // const positionalOpts = Object.keys(yargs.getGroups()[positionalGroup]);
        const cmdOpts = allOpts.filter(o => !globalOpts.includes(o) && !otherGroupOpts.includes(o));

        // apply group for all command options
        cmdOpts.forEach(o => {
          yargs.group(o, group);
        });
      };
    }
    return cmd;
  },

  yargsFilePathOption: function (file) {
    return path.resolve(file);
  },

  yargsExistingFileOption: function (file) {
    file = path.resolve(file);
    if (!fse.existsSync(file)) {
      return undefined;
    }
    return file;
  },

  extension: function (file) {
    return path.extname(file).split('.').pop();
  },

  timerStart: function () {
    return process.hrtime();
  },

  timerEnd: function (start) {
    const end = process.hrtime(start);
    const time = {
      seconds: end[0],
      nanoseconds: end[1],
    };
    return {
      seconds: time.seconds,
      nanoseconds: time.nanoseconds,
      toString: () => util.format('%ds %dms', time.seconds, Math.floor(time.nanoseconds / 1000000)),
      getSeconds: () => time.seconds + time.nanoseconds / 1000000000
    }
  },

  setLogFile: function (logFile) {
    // can't change the log file when piping to it
    if (!originalStdOut) {
      fse.ensureDirSync(path.dirname(logFile));
      // append to log file
      outFile = fse.createWriteStream(logFile, { flags: 'a' });
    }
  },

  redirectOutputToLogFile: function () {
    if (outFile && !originalStdOut) {
      originalStdOut = process.stdout.write;
      originalStdErr = process.stderr.write;
      process.stdout.write = process.stderr.write = outFile.write.bind(outFile);
    }
  },

  restoreOutput: function () {
    if (originalStdOut) {
      process.stdout.write = originalStdOut;
      process.stderr.write = originalStdErr;

      originalStdOut = undefined;
      originalStdErr = undefined;
    }
  },

  getOutputStdio: function () {
    if (outFile && originalStdOut) {
      return [process.stdin, outFile, outFile];
    } else {
      return [process.stdin, process.stdout, process.stderr];
    }
  },

  logToFile: function (...msg) {
    if (outFile) {
      const cons = new Console(outFile);
      if (msg.length === 0) {
        cons.log();
      } else {
        cons.log(...msg);
      }
    }
  },

  hasWarnings: function () {
    return hasWarnings;
  },

  logTrackedWarning: function (msg) {
    this.logWarn(msg);
    hasWarnings = true;
  },

  resetWarnings: function () {
    hasWarnings = false;
  },

  // detect npm link local versions
  isLinked(dir) {
    return fse.lstatSync(dir).isSymbolicLink();
  },

  latestModuleVersion(moduleName) {
    if (latestModuleVersions[moduleName]) {
      return latestModuleVersions[moduleName];
    }
    const version = execSync(`npm view ${moduleName} version`, { stdio: 'pipe' }).toString().trim();
    latestModuleVersions[moduleName] = version;
    return version;
  },

  packageVersion(name, dir = `${process.cwd()}`, oldName) {
    let pkgLock;
    try {
      // look at package-lock.json with the exact installed version number
      pkgLock = require(`${dir}/package-lock.json`);
    } catch (e) {
      // if we are inside a node_modules folder (e.g. nui deploy-all)
      if (dir.split(path.sep).includes('node_modules')) {
        // ...there is no package-lock.json, just a package.json
        pkgLock = require(`${dir}/package.json`);
      } else {
        util.logWarn(`${dir}: No package-lock.json found. You might need to run 'npm install'.`)
        return;
      }
    }

    if (pkgLock && pkgLock.dependencies) {
      try {
        const module = pkgLock.dependencies[name] || pkgLock.dependencies[oldName];
        let version = module.version || module;
        if (version.startsWith('^')) {
          version = version.substring(1);
        }
        return { pkgLock: pkgLock, version: version };
      } catch (ignore) {
      }
    }
  },

  checkLatestNuiLibraryVersion(dir = `${process.cwd()}`, name = NUI_LIBRARY, oldName = NUI_LIBRARY_OLD) {
    const versionInfo = this.packageVersion(name, dir, oldName);

    try {
      const version = this.latestModuleVersion(name);
      if (semver.lt(versionInfo.version, version)) {
        this.logWarn(`${versionInfo.pkgLock.name} ${versionInfo.pkgLock.version}: version of ${NUI_LIBRARY} ${versionInfo.version} is outdated. Latest is ${version}`);
      }
    } catch (ignore) {
    }
  },

  checkLatestActionVersion(name) {
    try {
      const versionInfo = this.packageVersion(name);
      const latestVersion = this.latestModuleVersion(name);
      if (semver.lt(versionInfo.version, latestVersion)) {
        this.logWarn(`${name} ${versionInfo.version} is outdated. Latest is ${latestVersion}`);
      }
    } catch (ignore) {
    }
  },

  checkNpmModulesInstalled() {
    if (!fse.existsSync('node_modules')) {
      this.logError('Directory node_modules does not exist.  Did you forget to run "npm install"?');
      process.exit(3);
    }

    if (!fse.existsSync('package-lock.json')) {
      this.logWarn('File package-lock.json does not exist.  Did you forget to run "npm install"?');
      return;
    }

    const statsPackage = fse.statSync('package.json');
    const statsLock = fse.statSync('package-lock.json');
    if (statsLock.mtime < statsPackage.mtime) {
      this.logWarn('File package.json has been modified more recently than package-lock.json.  Do you need to run "npm install"?');
    }
  }
}
