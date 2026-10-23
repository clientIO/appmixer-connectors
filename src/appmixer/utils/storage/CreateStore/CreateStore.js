'use strict';

module.exports = {

    async receive(context) {
        const { name, clear } = context.messages.in.content;
        let stores = await context.store.listStores();
        stores = stores.filter(store => store.name === name);

        if (stores.length > 0) {
            // listStores() returns the raw documents, where storeId is an ObjectId - sent as is
            // it leaves the component as a Buffer, not the 24-character id the store API takes.
            const storeId = String(stores[0].storeId);

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
