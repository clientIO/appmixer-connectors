'use strict';
const commons = require('../../evernote-commons');

/**
 * Component for fetching a notes in notebook
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { notebookGuid } = context.properties;
        let client = commons.getEvernoteAPI(context.auth.accessToken).getNoteStore();

        return client.findNotesMetadata(
            { notebookGuid: notebookGuid }, 0, 1000, { includeTitle: true }
        ).then(res => {
            return context.sendJson(res['notes'], 'notes');
        });
    }
};

