'use strict';
const ZohoClient = require('../../ZohoClient');

/**
 * Component for fetching accounts
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { allAtOnce, ids } = context.messages.in.content;
        const params = {};
        if (ids) {
            params['ids'] = ids;
        }
        let records = await (new ZohoClient(context)).getRecords('Accounts', { params });

        if (allAtOnce) {
            return context.sendJson({ records }, 'out');
        }

        let index = 0;
        for (const record of records) {
            await context.sendJson({ record, index }, 'out');
            index++;
        }
    },

    toSelectArray: ({ records }) => {

        let transformed = [];
        if (Array.isArray(records)) {
            transformed = records.map(
                // eslint-disable-next-line camelcase
                ({ id, Account_Name }) => ({ label: Account_Name, value: id })
            );

        }
        return transformed;
    }
};
