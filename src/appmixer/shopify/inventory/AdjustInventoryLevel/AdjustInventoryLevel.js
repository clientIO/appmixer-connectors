const commons = require('../../shopify-commons');

module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);

        const { location, adjustment, inventoryItem } = context.messages.in.content;

        try {
            const adjustments = await shopify.inventoryLevel.adjust({
                inventory_item_id: inventoryItem,
                location_id: location,
                available_adjustment: adjustment
            });

            return context.sendJson(adjustments, 'out');

        } catch (error) {
            context.log({ stage: 'error', error });
            throw error;
        }
    }
};
