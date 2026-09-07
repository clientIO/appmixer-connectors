'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const { data } = await hs.call('post', 'crm/v3/lists/search', { count: 500 });
        // Only contact lists — the list components and the NewContactInList
        // trigger work with the contacts object type.
        const lists = (data.lists || []).filter((list) => list.objectTypeId === '0-1');

        return context.sendJson(lists, 'out');
    },

    listsToSelectArray(lists) {

        if (!Array.isArray(lists)) return [];
        return lists.map((list) => ({
            label: `${list.name}${list.processingType === 'MANUAL' ? '' : ` (${list.processingType})`}`,
            value: list.listId
        }));
    }
};
