@adobe/aio-cli-plugin-asset-compute
=======================

Asset Compute Plugin for Adobe I/O Command Line Interface

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@adobe/aio-cli-plugin-asset-compute.svg)](https://npmjs.org/package/@adobe/aio-cli-plugin-asset-compute)

<!-- toc -->

<!-- tocstop -->

## Installation and Usage

This can be installed & used in three ways:

1. [aio plugin](#install-as-aio-plugin)
2. [local devDependency](#install-as-local-devdependency)
3. [global standalone cli](#install-as-global-standalone-cli)

### Install as aio plugin

This requires [aio-cli](https://github.com/adobe/aio-cli).

```
aio plugins:install @adobe/aio-cli-plugin-asset-compute
```

It provides the `asset-compute` command topic. You can run e.g. the test command using:

```
aio asset-compute test-worker
```

Help and available commands can be seen with:

```
aio asset-compute
```

### Install as local devDependency

Install into your `devDependencies`:

```
npm install --save-dev @adobe/aio-cli-plugin-asset-compute
```

Then use in `npm` scripts in your `package.json`, for example for tests:

```json
   "scripts": {
       "test": "adobe-asset-compute test-worker"
   }
```

Use `npx` if you want to manually run it. Inside your project run for example:

```
npx adobe-asset-compute run-worker
```

Help and available commands can be seen with:

```
npx adobe-asset-compute
```

### Install as global standalone cli

Install globally using:

```
npm install -g @adobe/aio-cli-plugin-asset-compute
```

This will add the `adobe-asset-compute` cli to your system. Run using:

```
adobe-asset-compute test-worker
```

Help and available commands can be seen with:

```
adobe-asset-compute
```

## Commands
<!-- commands -->
* [`adobe-asset-compute run-worker FILE RENDITION`](#adobe-asset-compute-run-worker-file-rendition)
* [`adobe-asset-compute test-worker [TESTCASE]`](#adobe-asset-compute-test-worker-testcase)

## `adobe-asset-compute run-worker FILE RENDITION`

Run worker from local project using Docker

```
USAGE
  $ adobe-asset-compute run-worker FILE RENDITION

ARGUMENTS
  FILE       Path to input file for worker

  RENDITION  Path where to create output rendition.
             Single file for single rendition, or directory to create multiple renditions, in which case the full
             parameter json including rendition names must be provided using --data.

OPTIONS
  -P, --paramFile=paramFile  Path to parameter json file.
  -a, --action=action        Worker to run. Use action name from manifest. Not required if there is only one.
  -d, --data=data            Complete input parameters as JSON string. Allows multiple renditions.
  -p, --param=param          <key> <value> - Set parameters for rendition, can be used multiple times
  -v, --verbose              Verbose output
  --version                  Show version
```

## `adobe-asset-compute test-worker [TESTCASE]`

Run tests from local project

```
USAGE
  $ adobe-asset-compute test-worker [TESTCASE]

ARGUMENTS
  TESTCASE  Test case(s) to run. Supports glob patterns. If not set, runs all tests.

OPTIONS
  -a, --action=action     Worker to test. Use action name from manifest. If not set, runs tests for all workers.
  -u, --updateRenditions  Replace expected renditions of failing test cases with the generated rendition.
  -v, --verbose           Verbose output
  --version               Show version

ALIASES
  $ adobe-asset-compute tw
```
<!-- commandsstop -->

## Contributing

Contributions are welcomed! Read the [Contributing Guide](./.github/CONTRIBUTING.md) for more information.

## Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.
