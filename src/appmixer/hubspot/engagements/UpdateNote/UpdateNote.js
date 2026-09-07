'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {
    async receive(context) {

        const {
            noteId,
            hsNoteBody
        } = context.messages.in.content;

        if (!noteId) {
            throw new context.CancelError('Note ID is required!');
        }
        if (!hsNoteBody) {
            throw new context.CancelError('Note Body is required!');
        }

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const payload = {
            properties: {
                hs_timestamp: new Date().toISOString(),
                hs_note_body: hsNoteBody
            }
        };

        const { data } = await hs.call(
            'patch',
            `crm/v3/objects/notes/${noteId}`,
            payload
        );

        return context.sendJson(data, 'out');
    }
};
