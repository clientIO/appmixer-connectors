'use strict';
const commons = require('../../pipedrive-commons');

/**
 * ListProducts
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const productsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Products');

        return productsApi.getAllAsync()
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (Array.isArray(response.data)) {
                    return context.sendJson(response.data.map(product => product.toObject()), 'out');
                }
            });
    }
};
