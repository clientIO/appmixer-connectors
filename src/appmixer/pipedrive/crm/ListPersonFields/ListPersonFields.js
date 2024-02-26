'use strict';
const commons = require('../../pipedrive-commons');

/**
 * GetAll person fields action.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const personsApi = commons.getPromisifiedClient(context.auth.apiKey, 'PersonFields');
        const fieldsResponse = await personsApi.getAllAsync();
        if (fieldsResponse.success === false) {
            throw new context.CancelError(fieldsResponse.formattedError);
        }
        return context.sendJson(fieldsResponse.data, 'out');
    }
};
