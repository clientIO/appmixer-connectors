'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {
    async receive(context) {

        const {
            noteId,
            hsNoteBody
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const payload = {
            properties: {
                hs_timestamp: new Date().toISOString(),
                hs_note_body: hsNoteBody
            }
        };

        context.log({ stage: 'Engagements - CreateNote payload', payload });

        const { data } = await hs.call(
            'post',
            `crm/v3/objects/notes/${noteId}`,
            payload
        );

        return context.sendJson(data, 'out');
    }
};
