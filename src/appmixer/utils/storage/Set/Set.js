'use strict';

module.exports = {

    async receive(context) {

        const { key, value } = context.messages.in.content;
        const { storeId } = context.properties;
        const setData = await context.store.set(storeId, key, value);

        return context.sendJson(Object.assign(setData, {
            newValue: value
        }), 'out');
    }
};
