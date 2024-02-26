'use strict';
const commons = require('../../evernote-commons');

/**
 * Component for creating a notebook
 * @extends {Component}
 */
module.exports = {

    receive(context) {

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

