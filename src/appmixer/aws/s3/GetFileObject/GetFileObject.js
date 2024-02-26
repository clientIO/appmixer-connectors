'use strict';
const commons = require('../../aws-commons');

/**
 * Deletes bucket.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { bucket, key } = context.messages.in.content;
        const { s3 } = commons.init(context);
        const params = { Bucket: bucket, Key: key };
        const metadata = await s3.headObject(params).promise();
        const stream = await s3.getObject(params).createReadStream();
        const file = await context.saveFileStream(key, stream);
        const object = Object.assign(params, metadata, { FileID: file.fileId });
        return context.sendJson(object, 'object');
    }
};
