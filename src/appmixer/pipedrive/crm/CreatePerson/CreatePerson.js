'use strict';
const commons = require('../../pipedrive-commons');

/**
 * CreatePerson action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.person.content;
        const personsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Persons');

        data.phone = commons.stringToContactArray(data.phone);
        data.email = commons.stringToContactArray(data.email);

        return personsApi.addAsync(data)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (response.success && response.data) {
                    return context.sendJson(response.data, 'newPerson');
                }
            });
    }
};
