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
 */

'use strict';

const mock = require('mock-require');
const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;

const loadConfigStub = sinon.stub();
mock('@adobe/aio-cli-lib-app-config', loadConfigStub);

const buildActionsStub = sinon.stub();
mock('@adobe/aio-lib-runtime', { buildActions: buildActionsStub });

const BaseCommand = require('../src/base-command');
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
    });

    it('function exists', () => {
        expect(typeof cmd.buildActionZip).equal('function');
    });

    it('general error', async () => {
        const error = new Error('some error');
        loadConfigStub.throws(error);

        expect(cmd.buildActionZip('some-action')).to.eventually.be.rejectedWith(error);
    });

    it('built zip does not exist', () => {
        loadConfigStub.returns({});
        buildActionsStub.returns(['foo.zip']);

        expect(cmd.buildActionZip('some-action')).to.eventually.be.rejectedWith('foo');
    });

    it('success', () => {

    });
});