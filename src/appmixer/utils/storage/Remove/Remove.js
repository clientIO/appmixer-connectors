'use strict';

module.exports = {

    async receive(context) {

        const { key } = context.messages.in.content;
        const { storeId } = context.properties;

        return context.sendJson(await context.store.remove(storeId, key), 'removed');
    }
};
