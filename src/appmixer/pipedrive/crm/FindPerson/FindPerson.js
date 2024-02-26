'use strict';
const commons = require('../../pipedrive-commons');
const Promise = require('bluebird');

/**
 * FindPerson action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.query.content;
        const personsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Persons');

        data['search_by_email'] = data.searchEmail === true ? 1 : 0;
        data['org_id'] = data.orgId;

        delete data.orgId;
        delete data.searchEmail;

        return personsApi.findAsync(data)
            .then(response => {

                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                } else {
                    if (Array.isArray(response.data)) {
                        return Promise.map(response.data, person => {
                            return context.sendJson(person.toObject(), 'person');
                        });
                    }
                }
            });
    }
};
