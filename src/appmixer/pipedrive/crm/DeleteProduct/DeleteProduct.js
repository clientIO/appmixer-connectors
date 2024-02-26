'use strict';
const commons = require('../../pipedrive-commons');

/**
 * DeleteProduct action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.product.content;
        const productsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Products');

        return productsApi.removeAsync(data.id)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
            });
    }
};
