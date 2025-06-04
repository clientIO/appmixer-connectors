'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {
    async receive(context) {

        const {
            noteId,
            hsTimestamp,
            hsNoteTitle,
            hsNoteBody
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const payload = {
            properties: {
                hs_timestamp: hsTimestamp,
                hs_note_title: hsNoteTitle,
                hs_note_body: hsNoteBody
            }
        };

        context.log({ stage: 'Engagements - UpdateNote payload', payload });

        const { data } = await hs.call(
            'patch',
            `crm/v3/objects/notes/${noteId}`,
            payload
        );

        return context.sendJson(data, 'out');
    }
};