'use strict';

module.exports = {

    async receive(context) {

        return context.sendJson(await context.store.listStores(), 'out');
    },

    toSelectArray(list) {

        return Array.isArray(list) ? list.map(i => ({ content: i.name, value: i.storeId })) : [];
    }
};
