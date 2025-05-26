'use strict';

module.exports = {

    async receive(context) {

        const { pattern, storeId } = context.messages.in.content;
        const items = await context.store.find(storeId, pattern);
        if (items.length > 0) {
            return context.sendJson({ items }, 'out');
        }
        return context.sendJson({ pattern, items }, 'notFound');
    }
};
