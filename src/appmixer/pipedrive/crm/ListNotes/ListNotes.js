'use strict';
const commons = require('../../pipedrive-commons');

/**
 * ListDeals
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const notesApi = commons.getPromisifiedClient(context.auth.apiKey, 'Notes');

        return notesApi.getAllAsync()
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (Array.isArray(response.data)) {
                    return context.sendJson(response.data.map(note => note.toObject()), 'out');
                }
            });
    }
};
