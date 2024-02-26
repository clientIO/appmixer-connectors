'use strict';
const commons = require('../../evernote-commons');
const xmldoc = require('xmldoc');

/**
 * Component for append content to note
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let noteContent = context.messages.content.content;
        let noteId = noteContent.noteId;
        delete noteContent.noteId;
        let newContent = null;
        let client = commons.getEvernoteAPI(context.auth.accessToken).getNoteStore();

        const xmlStructure = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">';

        return client.getNoteWithResultSpec(noteId, { includeContent: true })
            .then(res => {
                let cleanedString = res['content'].replace('\ufeff', '');
                newContent = new xmldoc.XmlDocument(cleanedString);

                // in case of plain text, there are no children
                if (newContent.children.length === 0) {
                    newContent.children.push(
                        (new xmldoc.XmlDocument(`<root><div>${newContent.val}</div></root>`)).firstChild);
                    // plain text has to be removed from val, otherwise it would be there twice
                    newContent.val = '';
                }

                newContent.children.push(
                    (new xmldoc.XmlDocument(`<root><div>${noteContent['noteContent']}</div></root>`)).firstChild);
                res['content'] = newContent = xmlStructure + newContent.toString();

                return client.updateNote(res);
            }).then(note => {
                // because evernote does not return content in updateNote result
                note.content = newContent;
                note['attributes'] = commons.formatFields(
                    note['attributes'],
                    ['reminderTime', 'reminderDoneTime'],
                    commons.formatDate);
                return context.sendJson(note, 'note');
            }).catch(err => {
                throw commons.verboseError(err);
            });
    }
};

