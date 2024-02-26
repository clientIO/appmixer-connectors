'use strict';
const commons = require('../../pipedrive-commons');

/**
 * ListOrganizations
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { filterId } = context.properties;
        const organizationsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Organizations');
        const options = {
            'filter_id': filterId,
            'user_id': 0 // list all organizations
        };

        return organizationsApi.getAllAsync(options)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (Array.isArray(response.data)) {
                    return context.sendJson(response.data.map(organization => organization.toObject()), 'out');
                }
            });
    }
};
