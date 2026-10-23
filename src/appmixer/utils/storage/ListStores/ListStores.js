'use strict';

module.exports = {

    async receive(context) {

        // The raw documents carry storeId as an ObjectId; downstream components need the string.
        const stores = (await context.store.listStores() || [])
            .map(store => ({ ...store, storeId: String(store.storeId) }));
        return context.sendJson(stores, 'out');
    },

    toSelectArray(list) {

        return Array.isArray(list) ? list.map(i => ({ content: i.name, value: i.storeId })) : [];
    }
};
