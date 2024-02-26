'use strict';
const commons = require('../../evernote-commons');

/**
 * Component for adding a note
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let note = context.messages.note.content;
        let { notebookGuid } = context.properties;
        let title = note['title'].replace(/\t/g, ' ').replace(/\n/g, ' ').trim();

        let noteBody = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">' +
            '<en-note>' + note['content'] + '</en-note>';

        let client = commons.getEvernoteAPI(context.auth.accessToken).getNoteStore();

        return client.createNote({ 'title': title, 'content': noteBody, 'notebookGuid': notebookGuid })
            .then(note => {
                // because evernote does not return content in response
                note.content = noteBody;
                note['attributes'] = commons.formatFields(
                    note['attributes'],
                    ['reminderTime', 'reminderDoneTime'],
                    commons.formatDate);
                return context.sendJson(note, 'newNote');
            }).catch(err => {
                throw commons.verboseError(err);
            });
    }
};

