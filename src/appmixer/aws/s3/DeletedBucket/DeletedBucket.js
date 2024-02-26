'use strict';
const { init } = require('../../aws-commons');

function processBuckets(buckets, deletedBuckets, bucket) {

    const found = buckets.find(({ Name }) => Name === bucket.Name);
    if (!found) {
        deletedBuckets.add(bucket);
    }
}

/**
 * Component which triggers whenever bucket is deleted.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const { s3 } = init(context);
        const { Buckets } = await s3.listBuckets().promise();

        const { buckets } = context.state;
        let diff = new Set();
        if (Array.isArray(buckets)) {
            buckets.forEach(processBuckets.bind(null, Buckets, diff));
        }

        if (diff.size) {
            const promises = [];
            diff.forEach(bucket => {
                promises.push(context.sendJson(bucket, 'deleted'));
            });
            await Promise.all(promises);
        }

        return context.saveState({ buckets: Buckets });
    }
};
