'use strict';
const ZohoClient = require('../../ZohoClient');

/**
 * Create a note attached to an existing record.
 */
module.exports = {

    async receive(context) {

        const { moduleName, recordId, noteTitle, noteContent } = context.messages.in.content;

        if (!moduleName) {
            throw new context.CancelError('Module is required!');
        }
        if (!recordId) {
            throw new context.CancelError('Record ID is required!');
        }
        if (!noteContent) {
            throw new context.CancelError('Note Content is required!');
        }

        const note = { Note_Content: noteContent };
        if (noteTitle) {
            note.Note_Title = noteTitle;
        }

        const client = new ZohoClient(context);
        // Creating the note through the parent record's related list means Zoho derives the parent
        // link itself, so the request body stays identical across API versions.
        const { details } = await client.createRelatedRecords(moduleName, recordId, 'Notes', [note]);

        return context.sendJson({
            id: details.id,
            Note_Title: noteTitle || '',
            Note_Content: noteContent,
            Parent_Id: recordId,
            se_module: moduleName,
            Created_Time: details.Created_Time
        }, 'out');
    }
};
