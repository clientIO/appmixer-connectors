'use strict';

const lib = require('../lib');
const { processItems } = lib;

/**
 * Component which triggers whenever new bucket is created.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const Buckets = await lib.listBuckets(context);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        if (Array.isArray(Buckets)) {
            Buckets.forEach(processItems.bind(null, known, actual, diff, 'Name'));
        }
        await context.saveState({ known: Array.from(actual) });

        if (diff.size) {
            const promises = [];
            diff.forEach(bucket => {
                promises.push(context.sendJson(bucket, 'bucket'));
            });
            return Promise.all(promises);
        }
    },

    async test(context) {

        // Fetch buckets the same way tick() does, but WITHOUT the state baseline that
        // suppresses output on the first poll. Emit the most recently created bucket so the
        // shape matches what tick() emits for a newly created one.
        const Buckets = await lib.listBuckets(context);
        if (!Buckets.length) {
            throw new Error('No buckets found to use as test data.');
        }

        const newest = Buckets.slice().sort((a, b) => {
            const da = a.CreationDate ? new Date(a.CreationDate).getTime() : 0;
            const db = b.CreationDate ? new Date(b.CreationDate).getTime() : 0;
            return db - da;
        })[0];

        return context.sendJson(newest, 'bucket');
    }
};
