'use strict';
const ZohoClient = require('../../ZohoClient');

/**
 * Component for fetching contacts
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { allAtOnce, ids } = context.messages.in.content;
        const params = {};
        if (ids) {
            params['ids'] = ids;
        }
        const records = await (new ZohoClient(context)).getRecords('Contacts', { params });

        if (allAtOnce) {
            return context.sendJson({ records }, 'out');
        }

        let index = 0;
        for (const record of records) {
            await context.sendJson({ record, index }, 'out');
            index++;
        }
    }
};
