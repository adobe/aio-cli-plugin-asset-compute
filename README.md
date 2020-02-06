@nui/aio-cli-plugin-nui
=======================

Asset Compute Plugin for Adobe I/O Command Line Interface

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
<!--- when a new release happens, the VERSION and URL in the badge have to be manually updated because it's a private registry --->
[![npm version](https://img.shields.io/badge/%40nui%2Faio--cli--plugin--nui-1.0.3-blue.svg)](https://artifactory.corp.adobe.com/artifactory/npm-nui-release/@nui/aio-cli-plugin-nui/-/@nui/aio-cli-plugin-nui-1.0.3.tgz)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage

This plugin has [aio-cli](https://github.com/adobe/aio-cli) as a prerequisite. Once `aio-cli` has been installed, the plugin can be installed and used as follows:

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

_See code: [src/commands/nui/envinfo.js](https://git.corp.adobe.com/nui/aio-cli-plugin-nui/blob/1.0.3/src/commands/nui/envinfo.js)_

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

_See code: [src/commands/nui/test-worker.js](https://git.corp.adobe.com/nui/aio-cli-plugin-nui/blob/1.0.3/src/commands/nui/test-worker.js)_
<!-- commandsstop -->
