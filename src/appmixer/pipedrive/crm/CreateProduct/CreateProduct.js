'use strict';
const commons = require('../../pipedrive-commons');

/**
 * CreateProduct action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.product.content;
        const productsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Products');

        if (data.price) {
            data.prices = [
                {
                    currency: data.currency,
                    price: data.price,
                    cost: data.cost,
                    'overhead_cost': data['overhead_cost']
                }
            ];
        }

        delete data.currency;
        delete data.price;
        delete data.cost;
        delete data['overhead_cost'];

        return productsApi.addAsync(data)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (response.success && response.data) {
                    return context.sendJson(response.data, 'newProduct');
                }
            });
    }
};
