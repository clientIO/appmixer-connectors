'use strict';

module.exports = {

    async receive(context) {

        const { key, value, storeId } = context.messages.in.content;
        const setData = await context.store.set(storeId, key, value);

        return context.sendJson(Object.assign(setData, {
            newValue: value
        }), 'out');
    }
};
