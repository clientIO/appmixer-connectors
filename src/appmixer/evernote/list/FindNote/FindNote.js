'use strict';
const commons = require('../../evernote-commons');
const Promise = require('bluebird');

/**
 * Component for searching a note
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { query, notebookGuid, tag } = context.messages.query.content;
        let client = commons.getEvernoteAPI(context.auth.accessToken).getNoteStore();
        let filter = {};

        filter.words = query ? query : undefined;
        filter.notebookGuid = notebookGuid ? notebookGuid : undefined;
        filter.tagGuids = tag ? [tag] : undefined;

        return client.findNotesMetadata(filter, 0, 100, {})
            .then(res => {
                let promises = [];
                res['notes'].forEach(note => {
                    promises.push(
                        client.getNoteWithResultSpec(note['guid'], { includeContent: true }));
                });
                return Promise.all(promises);
            }).then(data => {
                return Promise.map(data, note => {
                    note['attributes'] = commons.formatFields(
                        note['attributes'],
                        ['reminderTime', 'reminderDoneTime'],
                        commons.formatDate);
                    return context.sendJson(note, 'note');
                });
            }).catch(err => {
                throw commons.verboseError(err);
            });
    }
};

