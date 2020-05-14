@nui/aio-cli-plugin-asset-compute
=======================

Asset Compute Plugin for Adobe I/O Command Line Interface

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
<!--- when a new release happens, the VERSION and URL in the badge have to be manually updated because it's a private registry --->
[![npm version](https://img.shields.io/badge/%40nui%2Faio--cli--plugin--nui-1.0.8-blue.svg)](https://artifactory.corp.adobe.com/artifactory/npm-nui-release/@nui/aio-cli-plugin-nui/-/@nui/aio-cli-plugin-nui-1.0.8.tgz)

<!-- toc -->

<!-- tocstop -->

## Usage

This plugin has [aio-cli](https://github.com/adobe/aio-cli) as a prerequisite. Once `aio-cli` has been installed, the plugin can be installed and used as follows:

```sh-session
$ aio plugins:install @nui/aio-cli-plugin-asset-compute
$ aio asset-compute:test-worker --help
Usage information of the test-worker command
$ aio asset-compute:test-worker -u
Update rendition output
$ aio asset-compute:tw
Alias for the test-worker command
$ aio asset-compute:devtool
Runs the Asset Compute Developer Tool UI
```

## Commands
<!-- commands -->
* [`@nui/aio-cli-plugin-asset-compute asset-compute:devtool`](#nuiaio-cli-plugin-asset-compute-asset-computedevtool)
* [`@nui/aio-cli-plugin-asset-compute asset-compute:run-worker FILE RENDITION`](#nuiaio-cli-plugin-asset-compute-asset-computerun-worker-file-rendition)
* [`@nui/aio-cli-plugin-asset-compute asset-compute:test-worker [TESTCASE]`](#nuiaio-cli-plugin-asset-compute-asset-computetest-worker-testcase)

## `@nui/aio-cli-plugin-asset-compute asset-compute:devtool`

Runs the Asset Compute Developer Tool UI

```
USAGE
  $ @nui/aio-cli-plugin-asset-compute asset-compute:devtool

OPTIONS
  -v, --verbose  Verbose output
  --port=port    [default: 9000] Http port of the Asset Compute Developer Tool Server
  --version      Show version
```

_See code: [src/commands/asset-compute/devtool.js](https://github.com/nui/aio-cli-plugin-asset-compute/blob/1.0.8/src/commands/asset-compute/devtool.js)_

## `@nui/aio-cli-plugin-asset-compute asset-compute:run-worker FILE RENDITION`

Run worker from local project using Docker

```
USAGE
  $ @nui/aio-cli-plugin-asset-compute asset-compute:run-worker FILE RENDITION

ARGUMENTS
  FILE       Path to input file for worker

  RENDITION  Path where to create output rendition.
             Single file for single rendition, or directory to create multiple renditions, in which case the full
             parameter json including rendition names must be provided using --data.

OPTIONS
  -P, --paramFile=paramFile  Path to parameter json file.
  -a, --action=action        Worker to run. Use action name from manifest. Not required if there is only one.
  -d, --data=data            Complete input parameters as JSON string. Allows multiple renditions.
  -f, --fmt=fmt              Replace expected renditions of failing test cases with the generated rendition.
  -p, --param=param          <key> <value> - Set parameters for rendition, can be used multiple times
  -v, --verbose              Verbose output
  --version                  Show version
```

_See code: [src/commands/asset-compute/run-worker.js](https://github.com/nui/aio-cli-plugin-asset-compute/blob/1.0.8/src/commands/asset-compute/run-worker.js)_

## `@nui/aio-cli-plugin-asset-compute asset-compute:test-worker [TESTCASE]`

Run tests from local project

```
USAGE
  $ @nui/aio-cli-plugin-asset-compute asset-compute:test-worker [TESTCASE]

ARGUMENTS
  TESTCASE  Test case(s) to run. Supports glob patterns. If not set, runs all tests.

OPTIONS
  -a, --action=action     Worker to test. Use action name from manifest. If not set, runs tests for all workers.
  -u, --updateRenditions  Replace expected renditions of failing test cases with the generated rendition.
  -v, --verbose           Verbose output
  --version               Show version

ALIASES
  $ @nui/aio-cli-plugin-asset-compute asset-compute:tw
```

_See code: [src/commands/asset-compute/test-worker.js](https://github.com/nui/aio-cli-plugin-asset-compute/blob/1.0.8/src/commands/asset-compute/test-worker.js)_
<!-- commandsstop -->

## Contributing

Contributions are welcomed! Read the [Contributing Guide](./.github/CONTRIBUTING.md) for more information.

## Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.
