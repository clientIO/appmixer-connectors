'use strict';
const commons = require('../../evernote-commons');

/**
 * Component for creating a notebook
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        if (!context.messages.notebook.content.name) {
            throw new context.CancelError('Notebook name is required!');
        }

        let notebook = context.messages.notebook.content;
        let client = commons.getEvernoteAPI(context.auth.accessToken).getNoteStore();

        return client.createNotebook({ 'name': notebook['name'] })
            .then(notebook => {
                return context.sendJson(notebook, 'newNotebook');
            }).catch(err => {
                throw commons.verboseError(err);
            });
    }
};

