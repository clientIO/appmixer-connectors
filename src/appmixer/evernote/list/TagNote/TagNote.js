'use strict';
const commons = require('../../evernote-commons');

/**
 * Component for creating a tag for note
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { noteId, tag } = context.messages.note.content;
        let client = commons.getEvernoteAPI(context.auth.accessToken).getNoteStore();

        return client.getNoteWithResultSpec(noteId, {}).then(note => {

            note.tagGuids = note.tagGuids || [];

            if (note.tagGuids) {
                let check = false;
                if (note.tagGuids.length) {
                    for (let i = 0; i < note.tagGuids.length; i++) {
                        if (note.tagGuids[i] === tag) {
                            check = true;
                        }
                    }
                }

                if (!check) {
                    note.tagGuids.push(tag);
                }

                return client.updateNote(note);
            }

            // already has the tag, so, just return the note
            return Promise.resolved(note);
        }).then(updatedNote => {
            updatedNote['attributes'] = commons.formatFields(
                updatedNote['attributes'],
                ['reminderTime', 'reminderDoneTime'],
                commons.formatDate);
            return context.sendJson(updatedNote, 'updatedNote');
        }).catch(err => {
            throw commons.verboseError(err);
        });
    }
};

