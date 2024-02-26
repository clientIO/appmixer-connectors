'use strict';
const commons = require('../../pipedrive-commons');

/**
 * UpdatePerson action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.note.content;
        const notes = commons.getPromisifiedClient(context.auth.apiKey, 'Notes');

        const id = data.id;
        data.content = data.note;
        delete data.note;
        delete data.id;

        return notes.updateAsync(id, data)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                return context.sendJson(response.data, 'updatedNote');
            });
    }
};
