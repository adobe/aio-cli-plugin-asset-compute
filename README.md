@nui/aio-cli-plugin-nui
=======================

Asset Compute Plugin for Adobe I/O Command Line Interface

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
<!--- when a new release happens, the VERSION and URL in the badge have to be manually updated because it's a private registry --->
[![npm version](https://img.shields.io/badge/%40nui%2Faio--cli--plugin--nui-1.0.6-blue.svg)](https://artifactory.corp.adobe.com/artifactory/npm-nui-release/@nui/aio-cli-plugin-nui/-/@nui/aio-cli-plugin-nui-1.0.6.tgz)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage

This plugin has [aio-cli](https://github.com/adobe/aio-cli) as a prerequisite. Once `aio-cli` has been installed, the plugin can be installed and used as follows:

```sh-session
$ aio plugins:install @nui/aio-cli-plugin-nui
$ aio asset-compute:envinfo
Environment information
$ aio asset-compute:test-worker --help
Usage information of the test-worker command
$ aio asset-compute:test-worker -u
Update rendition output
$ aio asset-compute:tw
Alias for the test-worker command
$ aio asset-compute:devtool
Runs the Asset Compute Developer Tool UI
```

# Commands
<!-- commands -->
* [`@nui/aio-cli-plugin-nui asset-compute:devtool`](#nuiaio-cli-plugin-nui-asset-computedevtool)
* [`@nui/aio-cli-plugin-nui asset-compute:envinfo`](#nuiaio-cli-plugin-nui-asset-computeenvinfo)
* [`@nui/aio-cli-plugin-nui asset-compute:test-worker`](#nuiaio-cli-plugin-nui-asset-computetest-worker)

## `@nui/aio-cli-plugin-nui asset-compute:devtool`

Runs the Asset Compute Developer Tool UI

```
USAGE
  $ @nui/aio-cli-plugin-nui asset-compute:devtool

OPTIONS
  -v, --verbose  Verbose output
  --port=port    [default: 9000] Http port of the Asset Compute Developer Tool Server
  --version      Show version
```

_See code: [src/commands/asset-compute/devtool.js](https://git.corp.adobe.com/nui/aio-cli-plugin-nui/blob/1.0.5/src/commands/asset-compute/devtool.js)_

## `@nui/aio-cli-plugin-nui asset-compute:envinfo`

Display dev environment version information

```
USAGE
  $ @nui/aio-cli-plugin-nui asset-compute:envinfo

OPTIONS
  -v, --verbose  Verbose output
  --version      Show version
```

_See code: [src/commands/asset-compute/envinfo.js](https://git.corp.adobe.com/nui/aio-cli-plugin-nui/blob/1.0.5/src/commands/asset-compute/envinfo.js)_

## `@nui/aio-cli-plugin-nui asset-compute:test-worker`

Run tests from local project

```
USAGE
  $ @nui/aio-cli-plugin-nui asset-compute:test-worker

OPTIONS
  -u, --updateRenditions  Replace expected renditions of failing test cases with the generated rendition.
  -v, --verbose           Verbose output
  --version               Show version

ALIASES
  $ @nui/aio-cli-plugin-nui asset-compute:tw
```

_See code: [src/commands/asset-compute/test-worker.js](https://git.corp.adobe.com/nui/aio-cli-plugin-nui/blob/1.0.5/src/commands/asset-compute/test-worker.js)_
<!-- commandsstop -->
