'use strict';
const aggregators = require('../../aggregators');

/**
 * Component getting new mailchimp files.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let since = new Date();

        let files = await aggregators.getFiles({
            context,
            qs: {
                'since_created_at': context.state.since || since.toISOString()
            }
        });

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        // process all members given by the service
        files.forEach(context.utils.processItem.bind(null, known, current, diff, file => file.id));

        await Promise.all(diff.map(async (file) => {
            await context.sendJson(file, 'file');
        }));

        await context.saveState({
            known: Array.from(current),
            since: since
        });
    }
};
