/**
 *  ADOBE CONFIDENTIAL
 *  __________________
 * 
 *  Copyright 2018 Adobe Systems Incorporated
 *  All Rights Reserved.
 *  
 *  NOTICE:  All information contained herein is, and remains
 *  the property of Adobe Systems Incorporated and its suppliers,
 *  if any.  The intellectual and technical concepts contained
 *  herein are proprietary to Adobe Systems Incorporated and its
 *  suppliers and are protected by trade secret or copyright law.
 *  Dissemination of this information or reproduction of this material
 *  is strictly forbidden unless prior written permission is obtained
 *  from Adobe Systems Incorporated.
 */
// based on from serverless-openwhisk, MIT licensed
// but changed to drop usage of async Promises and some renaming
// https://github.com/serverless/serverless-openwhisk/blob/master/provider/credentials.js
'use strict';

const path = require('path');
const fse = require('fs-extra');

const ENV_PARAMS = ['OW_APIHOST', 'OW_AUTH', 'OW_NAMESPACE', 'OW_APIGW_ACCESS_TOKEN'];

function getWskPropsFile() {
  const Home = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
  return process.env.WSK_CONFIG_FILE || path.format({ dir: Home, base: '.wskprops' });
}

function readWskPropsFile() {
  const wskFilePath = getWskPropsFile();

  if (fse.existsSync(wskFilePath)) {
    return fse.readFileSync(wskFilePath, 'utf8');
  } else {
    return null;
  }
}

function getWskProps() {
  const data = readWskPropsFile();
  if (!data) return {};

  const wskProps = data.trim().split('\n')
  .map(line => line.split('='))
  .reduce((params, keyValue) => {
    params[keyValue[0].toLowerCase()] = keyValue[1]; // eslint-disable-line no-param-reassign
    return params;
  }, {});

  return wskProps;
}

function getWskEnvProps() {
  const envProps = {};
  ENV_PARAMS.forEach((envName) => {
    if (process.env[envName]) envProps[envName.slice(3).toLowerCase()] = process.env[envName];
  });
  return envProps;
}

module.exports = {
  get() {
    const props = Object.assign(getWskProps(), getWskEnvProps());
    if (props.auth) {
      props.api_key = props.auth;
      delete props.auth;
    }
    return props;
  },
  ENV_PARAMS,
};