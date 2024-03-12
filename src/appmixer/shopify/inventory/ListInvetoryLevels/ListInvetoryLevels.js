const commons = require('../../shopify-commons');

module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);
        const { location } = context.messages.in.content;

        // const inventoryLevels = await shopify.location.inventoryLevels(location);
        //
        // console.log(inventoryLevels);
        // context.log({ stage: 'aaa', inventoryLevels });

        // const params = {
        //     limit: 5,
        //     inventory_item_ids: context.messages.in.content.location
        // };

        const levels = await commons.pager({
            shopify,
            target: 'location',
            operation: 'inventoryLevels',
            params: location
        });

        return context.sendJson(levels, 'out');
    }
};
