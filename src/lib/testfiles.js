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

'use strict';

module.exports = {
    getFile
};

const util = require('../lib/util');
const path = require('path');
const fse = require('fs-extra');
const homedir = require('os').homedir();
const AmazonS3URI  = require('amazon-s3-uri');
const request = require('request');
const aws4  = require('aws4')

// Handles retrieving files residing in S3
function getFile(sourceFile) {
    return new Promise(function (resolve, reject) {
	// If is .link file we assume the contents are the name of an S3 url
        // We first see if it is already cached and if so just use that
        // Otherwise we attempt to retrieve it and put it in the cache
        if (path.basename(sourceFile).endsWith('.link')) {
            if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
                reject(Error('no s3 credentials found'));
            } else {
                const s3Url= AmazonS3URI(fse.readFileSync(sourceFile,"utf8"))
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
        } else {
            resolve(sourceFile);
        }
    });
}
           
