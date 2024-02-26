'use strict';
const commons = require('../../pipedrive-commons');
const Promise = require('bluebird');

/**
 * FindProduct action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.query.content;
        const productsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Products');

        return productsApi.findAsync(data)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (Array.isArray(response.data)) {
                    return Promise.map(response.data, product => {
                        return context.sendJson(product.toObject(), 'product');
                    });
                }
            });
    }
};
