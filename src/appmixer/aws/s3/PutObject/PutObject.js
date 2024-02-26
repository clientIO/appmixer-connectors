'use strict';
const s3Stream = require('s3-upload-stream');
const commons = require('../../aws-commons');

/**
 * Uploads an object.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const {
            bucket,
            key,
            fileId,
            acl,
            contentType,
            expiryDate,
            maxPartSize,
            concurrentParts
        } = context.messages.in.content;

        const { s3 } = commons.init(context);

        const uploadFn = () => {
            return new Promise(async (resolve, reject) => {
                try {
                    const stream = s3Stream(s3);
                    const pipe = stream.upload({
                        Bucket: bucket,
                        Key: key,
                        ACL: acl,
                        ContentType: contentType,
                        Expires: expiryDate
                    }).on('error', error => {
                        reject(error);
                    }).on('uploaded', details => {
                        resolve(details);
                    });

                    let sizeInBytes = 20971520; // 20 MB
                    if (maxPartSize) {
                        sizeInBytes = maxPartSize * 1048576;
                    }
                    pipe.maxPartSize(sizeInBytes);
                    pipe.concurrentParts(concurrentParts || 1);

                    const readStream = await context.getFileReadStream(fileId);
                    readStream.pipe(pipe);
                } catch (err) {
                    reject(err);
                }
            });
        };

        return context.sendJson(Object.assign({
            Bucket: bucket,
            ContentType: contentType,
            Expires: expiryDate
        }, await uploadFn()), 'object');
    }
};
