'use strict';
const commons = require('../../pipedrive-commons');

/**
 * UpdateProduct action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.product.content;
        const productsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Products');

        const id = data.id;

        data.prices = (data.prices || data.currency || data.cost || data['overhead_cost']) ? [{}] : [];
        if (data.price) {
            data.prices[0] = { price: data.price };
        }
        if (data.currency) {
            data.prices[0].currency = data.currency;
        }
        if (data.cost) {
            data.prices[0].cost = data.cost;
        }
        if (data['overhead_cost']) {
            data.prices[0]['overhead_cost'] = data['overhead_cost'];
        }

        delete data.id;
        delete data.currency;
        delete data.price;
        delete data.cost;
        delete data['overhead_cost'];

        return productsApi.updateAsync(id, data)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                return context.sendJson(response.data, 'updatedProduct');
            });
    }
};
