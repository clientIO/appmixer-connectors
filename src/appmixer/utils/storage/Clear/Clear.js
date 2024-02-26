'use strict';

module.exports = {

    async receive(context) {

        const { storeId } = context.messages.in.content;
        const result = await context.store.clear(storeId);
        result.storeId = storeId;
        return context.sendJson(result, 'cleared');
    }
};
