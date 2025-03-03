'use strict';
const commons = require('../../pipedrive-commons');

/**
 * UpdatePerson action.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {
        let data = context.messages.person.content;
        const personsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Persons');

        const id = data.id;
        delete data.id;

        data.phone = commons.stringToContactArray(data.phone);
        data.email = commons.stringToContactArray(data.email);

        const response = await personsApi.updateAsync(id, data);
        if (response.success === false) {
            throw new context.CancelError(response.formattedError);
        }
        return context.sendJson(response.data, 'updatedPerson');
    }
};
