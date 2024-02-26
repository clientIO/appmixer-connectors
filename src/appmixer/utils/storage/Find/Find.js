'use strict';

module.exports = {

    async receive(context) {

        const { pattern } = context.messages.in.content;
        const { storeId } = context.properties;
        const items = await context.store.find(storeId, pattern);
        if (items.length > 0) {
            return context.sendJson({ items }, 'out');
        }
        return context.sendJson({ pattern, items }, 'notFound');
    }
};
