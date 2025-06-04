'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {
    async receive(context) {

        const {
            contactId,
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
            },
            associations: [
                {
                    to: { id: contactId },
                    types: [
                        {
                            associationCategory: 'HUBSPOT_DEFINED',
                            associationTypeId: 3
                        }
                    ]
                }
            ]
        };

        context.log({ stage: 'Engagements - CreateNote payload', payload });

        const { data } = await hs.call(
            'post',
            'crm/v3/objects/notes',
            payload
        );

        return context.sendJson(data, 'out');
    }
};