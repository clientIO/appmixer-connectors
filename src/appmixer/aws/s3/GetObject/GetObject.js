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
        const response = await s3.getObject({ Bucket: bucket, Key: key }).promise();
        const object = Object.assign({ Bucket: bucket, Key: key }, response);
        return context.sendJson(object, 'object');
    }
};
