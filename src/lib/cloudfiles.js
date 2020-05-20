/*
 * Copyright 2020 Adobe. All rights reserved.
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

module.exports = getCloudFile;

const util = require('./util');
const path = require('path');
const fse = require('fs-extra');
const homedir = require('os').homedir();
const AmazonS3URI  = require('amazon-s3-uri');
const request = require('request');
const aws4  = require('aws4');

async function getCloudFile(file) {
    // If is .link file we assume the contents are the name of a cloud (S3) url
    if (file && path.extname(file) === ".link") {
        return loadCloudFile(file);
    } else {
        return file;
    }
}

// Handles retrieving files residing in S3
function loadCloudFile(sourceFile) {
    return new Promise(function (resolve, reject) {
    	// contents of the file should be an S3 url
        // We first see if it is already cached and if so just use that
        // Otherwise we attempt to retrieve it and put it in the cache
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            reject(new Error('no s3 credentials found'));

        } else {
            const s3Url= AmazonS3URI(fse.readFileSync(sourceFile,"utf8"));
            const cachePath = `${homedir}/.nui/cache/${s3Url.uri.host}${s3Url.uri.pathname}`;
            if (fse.existsSync(cachePath)) { // if file is cached, do not download from s3
                util.log(`File cached under ${cachePath}`);
                resolve(cachePath);

            } else {
                util.log(`File not cached under ${cachePath}`);
                const opts = {
                    service: 's3',
                    path: `/${s3Url.bucket}/${s3Url.key}`,
                    url: `https://${s3Url.uri.host}/${s3Url.bucket}/${s3Url.key}`,
                };
                aws4.sign(opts);
                const targetDir = path.dirname(cachePath);
                if (! fse.existsSync(targetDir)) {
                    fse.mkdirSync(targetDir, {recursive: true} );
                }
                const stream = request(opts).pipe(fse.createWriteStream(cachePath));
                stream.on('finish', function() {
                    resolve(cachePath);
                });
            }
        }
    });
}
