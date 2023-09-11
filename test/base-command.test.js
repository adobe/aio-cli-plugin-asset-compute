/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 *
 */

'use strict';

const proxyQuire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;

const loadConfigStub = sinon.stub();
const buildActionsStub = sinon.stub();
const existsSyncStub = sinon.stub();

const BaseCommand = proxyQuire('../src/base-command', {
    '@adobe/aio-cli-lib-app-config': loadConfigStub,
    '@adobe/aio-lib-runtime': { buildActions: buildActionsStub },
    'fs-extra': { existsSync: existsSyncStub }
});
const { Command } = require('@oclif/core');

it('exports', async () => {
    expect(typeof BaseCommand).equal('function');
    expect(BaseCommand.prototype instanceof Command).to.be.true;
});

describe('buildActionZip', () => {
    const cmd = new BaseCommand();

    beforeEach(() => {
        loadConfigStub.reset();
        buildActionsStub.reset();
        existsSyncStub.reset();
    });

    it('function exists', () => {
        expect(typeof cmd.buildActionZip).equal('function');
    });

    it('error: general error', async () => {
        const error = new Error('some error');
        loadConfigStub.throws(error);

        const promise = cmd.buildActionZip('some-action');
        expect(promise).to.eventually.be.rejectedWith(error);
    });

    it('error: no actions built', async () => {
        loadConfigStub.returns({ all: {}});
        buildActionsStub.returns(['foo.zip']);

        const promise = cmd.buildActionZip('some-action');
        return expect(promise).to.eventually.be.rejectedWith('Failed to build action: No action was built.');
    });

    it('error: built zip does not exist', async () => {
        loadConfigStub.returns({ all: { a: {} }}); // dummy config
        const zipFile = 'foo.zip';
        buildActionsStub.returns([zipFile]);

        const promise = cmd.buildActionZip('some-action');
        return expect(promise).to.eventually.be.rejectedWith(`Building action failed, did not create ${zipFile}`);
    });

    it('success', () => {
        loadConfigStub.returns({ all: { a: {} }}); // dummy config
        const zipFile = 'foo.zip';
        buildActionsStub.returns([zipFile]);
        existsSyncStub.returns(true);

        const promise = cmd.buildActionZip('some-action');
        return expect(promise).to.eventually.equal(zipFile);
    });
});
