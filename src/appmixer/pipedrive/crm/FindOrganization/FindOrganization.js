'use strict';
const commons = require('../../pipedrive-commons');
const Promise = require('bluebird');

/**
 * FindOrganization action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.query.content;
        const organizationsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Organizations');

        return organizationsApi.findAsync(data)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (Array.isArray(response.data)) {
                    return Promise.map(response.data, organization => {
                        return context.sendJson(organization.toObject(), 'organization');
                    });
                }
            });
    }
};
