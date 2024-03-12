const commons = require('../../shopify-commons');

module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);

        // /admin/products/[ID_PRODUCT]/variants/[ID_VARIANT].json


        const locations = await shopify.product.list();
        return context.sendJson(locations, 'out');
    },

    locationsToSelectArray(locations) {

        return locations.map(location => {
            return { label: location.name, value: location.id };
        });
    }

};
