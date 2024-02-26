'use strict';
const commons = require('../../pipedrive-commons');

/**
 * DeleteNote action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const data = context.messages.note.content;
        const notesApi = commons.getPromisifiedClient(context.auth.apiKey, 'Notes');

        return notesApi.removeAsync(data.id)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
            });
    }
};
