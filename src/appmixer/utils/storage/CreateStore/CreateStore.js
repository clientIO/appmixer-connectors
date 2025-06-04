'use strict';

module.exports = {

    async receive(context) {
        const { name, clear } = context.messages.in.content;
        let stores = await context.store.listStores();
        stores = stores.filter(store => store.name === name);

        if (stores.length > 0) {
            const storeId = stores[0].storeId;

            if (clear) {
                await context.store.clear(storeId);
            }

            return context.sendJson({ storeId }, 'out');
        }

        const newStore = await context.callAppmixer({
            endPoint: '/stores',
            method: 'POST',
            body: {
                name
            }
        });

        const storeId = newStore.storeId;
        return context.sendJson({ storeId }, 'out');
    }
};
