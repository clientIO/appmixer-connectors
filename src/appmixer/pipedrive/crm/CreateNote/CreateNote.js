'use strict';
const commons = require('../../pipedrive-commons');

/**
 * CreateNote action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.note.content;
        const noteApi = commons.getPromisifiedClient(context.auth.apiKey, 'Notes');

        data.content = data.note;
        delete data.note;

        return noteApi.addAsync(data)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (response.success && response.data) {
                    return context.sendJson(response.data, 'newNote');
                }
            });
    }
};
