[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io) [![Version](https://img.shields.io/npm/v/@adobe/aio-cli-plugin-asset-compute.svg)](https://npmjs.org/package/@adobe/aio-cli-plugin-asset-compute) [![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0) [![codecov](https://codecov.io/gh/adobe/aio-cli-plugin-asset-compute/branch/master/graph/badge.svg)](https://codecov.io/gh/adobe/aio-cli-plugin-asset-compute) [![Travis](https://travis-ci.com/adobe/aio-cli-plugin-asset-compute.svg?branch=master)](https://travis-ci.com/adobe/aio-cli-plugin-asset-compute)


@adobe/aio-cli-plugin-asset-compute
=======================

Asset Compute Plugin for the [Adobe I/O CLI](https://github.com/adobe/aio-cli). This plugin supports developing and testing of [Asset Compute custom workers](https://docs.adobe.com/content/help/en/asset-compute/using/extend/understand-extensibility.html).

<!-- toc -->

<!-- tocstop -->

## Documentation

Further documentation:

- [Developing with `devtool`](https://docs.adobe.com/content/help/en/asset-compute/using/extend/develop-custom-application.html)
- [Adding custom tests with `test-worker` framework](https://docs.adobe.com/content/help/en/asset-compute/using/extend/test-custom-application.html)

## Installation and Usage

For interactive use as developer, install this as [aio-cli](https://github.com/adobe/aio-cli) plugin using:

```
aio plugins:install @adobe/aio-cli-plugin-asset-compute
```

To list available commands, run

```
aio asset-compute
```

See [commands](#commands) for a description of all commands.

When `aio asset-compute` is run inside a project directory with a `package.json` with the plugin installed as devDependency (see below), then it will use exactly that dependency version (available since `1.4.0`). This ensures test execution behaves the same as with `aio app test` in e.g. CI builds, even if the plugin version installed by the developer in `aio` is different. In other directories it will simply use its own command implementations.

### Use as project Dependency

Inside Asset Compute [App Builder](https://www.adobe.io/app-builder/) projects, `@adobe/aio-cli-plugin-asset-compute` will also be present as npm [devDependency](https://docs.npmjs.com/specifying-dependencies-and-devdependencies-in-a-package-json-file). This is used by `aio app test` and `aio app run`.

Projects created using `aio app init` with the Asset Compute Worker generator will automatically be include this dependency in their `package.json`, so no separate installation is required.

In case of creating a project setup from scratch, install it as `devDependency` using:

```
npm install --save-dev @adobe/aio-cli-plugin-asset-compute
```

Then it can be used with `aio app test` or `npm test` by adding a test script to the `package.json`. Or an `aio app` hook such as `post-app-run`. Note that the bin name is `adobe-asset-compute` in this case:

```
    "scripts": {
        "test": "adobe-asset-compute test-worker",
        "post-app-run": "adobe-asset-compute devtool"
    }
```

### Debugging workers

If you use the [debug](https://www.npmjs.com/package/debug) library inside your worker code, you can enable it in `test-worker` and `run-worker` commands by setting the `WORKER_DEBUG` environment variable just like the standard `DEBUG` variable:

```
WORKER_DEBUG=mystuff aio asset-compute test-worker
```

## Commands

<!-- commands -->
* [`aio devtool`](#aio-devtool)
* [`aio run-worker FILE RENDITION`](#aio-run-worker-file-rendition)
* [`aio test-worker [TESTCASE]`](#aio-test-worker-testcase)

## `aio devtool`

Starts the Asset Compute Developer Tool

```
USAGE
  $ aio devtool [-v] [--version] [--port <value>]

FLAGS
  -v, --verbose   Verbose output
  --port=<value>  [default: 9000] Http port of the Asset Compute Developer Tool Server
  --version       Show version

DESCRIPTION
  Starts the Asset Compute Developer Tool
```

## `aio run-worker FILE RENDITION`

Run worker from local project using Docker

```
USAGE
  $ aio run-worker [FILE] [RENDITION] [-v] [--version] [-a <value>] [-d <value> | -P <value> | -p <value>]

ARGUMENTS
  FILE       Path to input file for worker
  RENDITION  Path where to create output rendition.
             Single file for single rendition, or directory to create multiple renditions, in which case the full
             parameter json including rendition names must be provided using --data.

FLAGS
  -P, --paramFile=<value>  Path to parameter json file.
  -a, --action=<value>     Worker to run. Use action name from manifest. Not required if there is only one.
  -d, --data=<value>       Complete input parameters as JSON string. Allows multiple renditions.
  -p, --param=<value>...   <key> <value> - Set parameters for rendition, can be used multiple times
  -v, --verbose            Verbose output
  --version                Show version

DESCRIPTION
  Run worker from local project using Docker
```

## `aio test-worker [TESTCASE]`

Run tests from local project

```
USAGE
  $ aio test-worker [TESTCASE] [-v] [--version] [-a <value>] [-u]

ARGUMENTS
  TESTCASE  Test case(s) to run. Supports glob patterns. If not set, runs all tests.

FLAGS
  -a, --action=<value>    Worker to test. Use action name from manifest. If not set, runs tests for all workers.
  -u, --updateRenditions  Replace expected renditions of failing test cases with the generated rendition.
  -v, --verbose           Verbose output
  --version               Show version

DESCRIPTION
  Run tests from local project

ALIASES
  $ aio tw
```
<!-- commandsstop -->

## Contributing

Contributions are welcomed! Read the [Contributing Guide](./.github/CONTRIBUTING.md) for more information.

## Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.
