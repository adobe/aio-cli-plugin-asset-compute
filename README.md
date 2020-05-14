@adobe/aio-cli-plugin-asset-compute
=======================

Asset Compute Plugin for Adobe I/O Command Line Interface

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@adobe/aio-cli-plugin-asset-compute.svg)](https://npmjs.org/package/@adobe/aio-cli-plugin-asset-compute)

<!-- toc -->

<!-- tocstop -->

## Usage

This plugin has [aio-cli](https://github.com/adobe/aio-cli) as a prerequisite. Once `aio-cli` has been installed, the plugin can be installed and used as follows:

```sh-session
$ aio plugins:install @adobe/aio-cli-plugin-asset-compute
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
* [`@adobe/aio-cli-plugin-asset-compute asset-compute:devtool`](#adobeaio-cli-plugin-asset-compute-asset-computedevtool)
* [`@adobe/aio-cli-plugin-asset-compute asset-compute:run-worker FILE RENDITION`](#adobeaio-cli-plugin-asset-compute-asset-computerun-worker-file-rendition)
* [`@adobe/aio-cli-plugin-asset-compute asset-compute:test-worker [TESTCASE]`](#adobeaio-cli-plugin-asset-compute-asset-computetest-worker-testcase)

## `@adobe/aio-cli-plugin-asset-compute asset-compute:devtool`

Runs the Asset Compute Developer Tool UI

```
USAGE
  $ @adobe/aio-cli-plugin-asset-compute asset-compute:devtool

OPTIONS
  -v, --verbose  Verbose output
  --port=port    [default: 9000] Http port of the Asset Compute Developer Tool Server
  --version      Show version
```

_See code: [src/commands/asset-compute/devtool.js](https://github.com/adobe/aio-cli-plugin-asset-compute/blob/1.0.0/src/commands/asset-compute/devtool.js)_

## `@adobe/aio-cli-plugin-asset-compute asset-compute:run-worker FILE RENDITION`

Run worker from local project using Docker

```
USAGE
  $ @adobe/aio-cli-plugin-asset-compute asset-compute:run-worker FILE RENDITION

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

_See code: [src/commands/asset-compute/run-worker.js](https://github.com/adobe/aio-cli-plugin-asset-compute/blob/1.0.0/src/commands/asset-compute/run-worker.js)_

## `@adobe/aio-cli-plugin-asset-compute asset-compute:test-worker [TESTCASE]`

Run tests from local project

```
USAGE
  $ @adobe/aio-cli-plugin-asset-compute asset-compute:test-worker [TESTCASE]

ARGUMENTS
  TESTCASE  Test case(s) to run. Supports glob patterns. If not set, runs all tests.

OPTIONS
  -a, --action=action     Worker to test. Use action name from manifest. If not set, runs tests for all workers.
  -u, --updateRenditions  Replace expected renditions of failing test cases with the generated rendition.
  -v, --verbose           Verbose output
  --version               Show version

ALIASES
  $ @adobe/aio-cli-plugin-asset-compute asset-compute:tw
```

_See code: [src/commands/asset-compute/test-worker.js](https://github.com/adobe/aio-cli-plugin-asset-compute/blob/1.0.0/src/commands/asset-compute/test-worker.js)_
<!-- commandsstop -->

## Contributing

Contributions are welcomed! Read the [Contributing Guide](./.github/CONTRIBUTING.md) for more information.

## Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.
