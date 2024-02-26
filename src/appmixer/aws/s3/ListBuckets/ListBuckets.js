'use strict';
const commons = require('../../aws-commons');

/**
 * List all buckets.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { sendWholeArray } = context.properties;

        const { s3 } = commons.init(context);
        const { Buckets } = await s3.listBuckets().promise();

        if (sendWholeArray) {
            return context.sendJson(Buckets, 'bucket');
        } else {
            const promises = [];
            Buckets.forEach(bucket => {
                promises.push(context.sendJson(bucket, 'bucket'));
            });
            return Promise.all(promises);
        }
    },

    bucketsToSelectArray(buckets) {

        if (buckets && Array.isArray(buckets)) {
            return buckets.map(bucket => ({
                label: bucket.Name,
                value: bucket.Name
            }));
        }
        return [];
    }
};
