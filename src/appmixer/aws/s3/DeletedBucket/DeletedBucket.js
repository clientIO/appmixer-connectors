'use strict';
const lib = require('../lib');

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
        const Buckets = await lib.listBuckets(context);

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
    },

    async test(context) {

        // A deleted bucket can't be fetched read-only (it no longer exists), so emit an
        // existing bucket as a representative example. The shape is identical to what tick()
        // emits on the 'deleted' port: a raw bucket object ({ Name, CreationDate, ... }).
        const Buckets = await lib.listBuckets(context);
        if (!Buckets.length) {
            throw new Error('No buckets found to use as test data.');
        }

        const newest = Buckets.slice().sort((a, b) => {
            const da = a.CreationDate ? new Date(a.CreationDate).getTime() : 0;
            const db = b.CreationDate ? new Date(b.CreationDate).getTime() : 0;
            return db - da;
        })[0];

        return context.sendJson(newest, 'deleted');
    }
};
