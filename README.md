@nui/aio-cli-plugin-nui
=======================

Asset Compute Plugin for Adobe I/O Command Line Interface

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@nui/aio-cli-plugin-nui.svg)](https://npmjs.org/package/@nui/aio-cli-plugin-nui)
[![Downloads/week](https://img.shields.io/npm/dw/@nui/aio-cli-plugin-nui.svg)](https://npmjs.org/package/@nui/aio-cli-plugin-nui)
[![License](https://img.shields.io/npm/l/@nui/aio-cli-plugin-nui.svg)](https://github.com/nui/aio-cli-plugin-nui/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage



```sh-session
$ aio plugins:install @nui/aio-cli-plugin-nui
$ aio nui:envinfo
Environment information
$ aio nui:test-worker --help
Usage information of the test-worker command
$ aio nui:test-worker -u
Update rendition output
$ aio nui:tw
Alias for the test-worker command
```

# Commands
<!-- commands -->
* [`@nui/aio-cli-plugin-nui nui:envinfo`](#nuiaio-cli-plugin-nui-nuienvinfo)
* [`@nui/aio-cli-plugin-nui nui:test-worker`](#nuiaio-cli-plugin-nui-nuitest-worker)

## `@nui/aio-cli-plugin-nui nui:envinfo`

Display dev environment version information

```
USAGE
  $ @nui/aio-cli-plugin-nui nui:envinfo

OPTIONS
  -v, --verbose  Verbose output
  --version      Show version
```

_See code: [src/commands/nui/envinfo.js](https://git.corp.adobe.com/nui/aio-cli-plugin-nui/blob/0.0.1/src/commands/nui/envinfo.js)_

## `@nui/aio-cli-plugin-nui nui:test-worker`

Run tests from local project

```
USAGE
  $ @nui/aio-cli-plugin-nui nui:test-worker

OPTIONS
  -u, --updateRenditions  Replace expected renditions of failing test cases with the generated rendition.
  -v, --verbose           Verbose output
  --version               Show version

ALIASES
  $ @nui/aio-cli-plugin-nui nui:tw
```

_See code: [src/commands/nui/test-worker.js](https://git.corp.adobe.com/nui/aio-cli-plugin-nui/blob/0.0.1/src/commands/nui/test-worker.js)_
<!-- commandsstop -->
