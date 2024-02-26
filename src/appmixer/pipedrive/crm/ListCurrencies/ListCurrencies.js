'use strict';
const commons = require('../../pipedrive-commons');

/**
 * ListCurrencies
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const currencies = commons.getPromisifiedClient(context.auth.apiKey, 'Currencies');

        return currencies.getAllAsync()
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (Array.isArray(response.data)) {
                    return context.sendJson(response.data.map(currency => currency.toObject()), 'out');
                }
            });
    }
};
