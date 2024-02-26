'use strict';
const commons = require('../../pipedrive-commons');
const Promise = require('bluebird');

/**
 * FindDeal action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.query.content;
        const dealsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Deals');

        data['org_id'] = data.orgId;
        data['person_id'] = data.personId;
        delete data.orgId;
        delete data.personId;

        return dealsApi.findAsync(data)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (Array.isArray(response.data)) {
                    return Promise.map(response.data, deal => {
                        return context.sendJson(deal.toObject(), 'deal');
                    });
                }
            });
    }
};
