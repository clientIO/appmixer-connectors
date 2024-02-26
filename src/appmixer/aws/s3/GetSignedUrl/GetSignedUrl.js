'use strict';
const commons = require('../../aws-commons');

module.exports = {

    async receive(context) {

        const { bucket, key, expires = 86400, operation = 'getObject' } = context.messages.in.content;
        const { s3 } = commons.init(context);
        const url = await s3.getSignedUrlPromise(operation, { Bucket: bucket, Key: key, Expires: expires });
        const msg = {
            Bucket: bucket,
            Key: key,
            Expires: expires,
            Url: url
        };
        return context.sendJson(msg, 'url');
    }
};
