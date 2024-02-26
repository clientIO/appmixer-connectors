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
        await s3.deleteObject({ Bucket: bucket, Key: key }).promise();

        return context.sendJson({ Bucket: bucket, Key: key }, 'deleted');
    }
};
