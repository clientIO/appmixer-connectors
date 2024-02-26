'use strict';
const commons = require('../../pipedrive-commons');

/**
 * UpdatePerson action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.person.content;
        const personsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Persons');

        const id = data.id;
        delete data.id;

        data.phone = commons.stringToContactArray(data.phone);
        data.email = commons.stringToContactArray(data.email);

        return personsApi.updateAsync(id, data)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                return context.sendJson(response.data, 'updatedPerson');
            });
    }
};
