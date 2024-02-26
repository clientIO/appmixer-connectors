'use strict';
const commons = require('../../pipedrive-commons');

/**
 * CreateDeal action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.deal.content;
        const dealsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Deals');

        return dealsApi.addAsync(data)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                return context.sendJson(response.data, 'newDeal');
            });
    }
};
