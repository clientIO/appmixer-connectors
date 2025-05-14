'use strict';

module.exports = {

    async receive(context) {

        const { key, storeId } = context.messages.in.content;

        return context.sendJson(await context.store.remove(storeId, key), 'removed');
    }
};
