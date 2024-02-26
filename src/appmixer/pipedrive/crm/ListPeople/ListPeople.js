'use strict';
const commons = require('../../pipedrive-commons');

/**
 * ListPeople
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { filterId } = context.properties;
        const peopleApi = commons.getPromisifiedClient(context.auth.apiKey, 'Persons');
        const options = {
            'filter_id': filterId,
            'user_id': 0 // list all persons
        };

        return peopleApi.getAllAsync(options)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (Array.isArray(response.data)) {
                    return context.sendJson(response.data.map(person => person.toObject()), 'out');
                }
            });
    }
};
