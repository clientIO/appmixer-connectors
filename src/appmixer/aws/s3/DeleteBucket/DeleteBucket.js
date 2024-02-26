'use strict';
const commons = require('../../aws-commons');

/**
 * Deletes bucket.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { s3 } = commons.init(context);

        const { bucket } = context.messages.in.content;
        await s3.deleteBucket({ Bucket: bucket }).promise();

        return context.sendJson({ Name: bucket }, 'deleted');
    }
};
