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
<!-- usage -->
```sh-session
$ npm install -g @nui/aio-cli-plugin-nui
$ @nui/aio-cli-plugin-nui COMMAND
running command...
$ @nui/aio-cli-plugin-nui (-v|--version|version)
@nui/aio-cli-plugin-nui/0.0.0 darwin-x64 node-v12.13.0
$ @nui/aio-cli-plugin-nui --help [COMMAND]
USAGE
  $ @nui/aio-cli-plugin-nui COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`@nui/aio-cli-plugin-nui base-command`](#nuiaio-cli-plugin-nui-base-command)
* [`@nui/aio-cli-plugin-nui nui:envinfo`](#nuiaio-cli-plugin-nui-nuienvinfo)
* [`@nui/aio-cli-plugin-nui nui:test-worker`](#nuiaio-cli-plugin-nui-nuitest-worker)

## `@nui/aio-cli-plugin-nui base-command`

```
USAGE
  $ @nui/aio-cli-plugin-nui base-command

OPTIONS
  -v, --verbose  Verbose output
  --version      Show version
```

_See code: [src/commands/base-command.js](https://git.corp.adobe.com/nui/aio-cli-plugin-nui/blob/0.0.0/src/commands/base-command.js)_

## `@nui/aio-cli-plugin-nui nui:envinfo`

Display dev environment version information

```
USAGE
  $ @nui/aio-cli-plugin-nui nui:envinfo

OPTIONS
  -v, --verbose  Verbose output
  --version      Show version
```

_See code: [src/commands/nui/envinfo.js](https://git.corp.adobe.com/nui/aio-cli-plugin-nui/blob/0.0.0/src/commands/nui/envinfo.js)_

## `@nui/aio-cli-plugin-nui nui:test-worker`

Run tests from local project

```
USAGE
  $ @nui/aio-cli-plugin-nui nui:test-worker

OPTIONS
  -u, --updateRenditions  Replace expected renditions of failing test cases with the generated rendition.
```

_See code: [src/commands/nui/test-worker.js](https://git.corp.adobe.com/nui/aio-cli-plugin-nui/blob/0.0.0/src/commands/nui/test-worker.js)_
<!-- commandsstop -->
