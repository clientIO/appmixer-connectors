'use strict';
const commons = require('../../pipedrive-commons');

/**
 * CreateOrganization action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.organization.content;
        const organizationsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Organizations');

        return organizationsApi.addAsync(data)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (response.success && response.data) {
                    return context.sendJson(response.data, 'newOrganization');
                }
            });
    }
};
