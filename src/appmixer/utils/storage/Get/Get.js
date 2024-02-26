'use strict';

module.exports = {

    async receive(context) {

        const { key } = context.messages.in.content;
        const { storeId } = context.properties;

        const value = await context.store.get(storeId, key);
        if (value.value === null) {
            return context.sendJson({ key }, 'notFound');
        }
        return context.sendJson(value, 'out');
    }
};
