'use strict';
const commons = require('../../pipedrive-commons');

/**
 * ListDeals
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { filterId } = context.properties;
        const dealsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Deals');
        const options = {
            'filter_id': filterId,
            'user_id': 0 // list all deals
        };

        return dealsApi.getAllAsync(options)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (Array.isArray(response.data)) {
                    return context.sendJson(response.data.map(deal => deal.toObject()), 'out');
                }
            });
    }
};
