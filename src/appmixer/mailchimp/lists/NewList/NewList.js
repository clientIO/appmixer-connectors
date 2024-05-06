'use strict';
const mailchimpDriver = require('../../commons');

/**
 * Component listing lists
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let since = new Date();

        let lists = await mailchimpDriver.lists.lists(context, {
            qs: {
                'since_date_created': context.state.since || since.toISOString()
            }
        });

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        if (Array.isArray(lists)) {
            lists.forEach(context.utils.processItem.bind(null, known, current, diff, list => list.id));
        }

        await Promise.all(diff.map((list) => {
            return context.sendJson(list, 'list');
        }));

        await context.saveState({
            known: Array.from(current),
            since: since
        });
    }
};
