'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {
    async receive(context) {

        const {
            associationTypeId,
            objectId,
            hsNoteBody
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const payload = {
            properties: {
                hs_timestamp: new Date().toISOString(),
                hs_note_body: hsNoteBody
            },
            associations: [
                {
                    to: { id: objectId },
                    types: [
                        {
                            associationCategory: 'HUBSPOT_DEFINED',
                            // https://developers.hubspot.com/docs/api/crm/associations#association-type-id-values
                            associationTypeId
                        }
                    ]
                }
            ]
        };

        context.log({ stage: 'Engagements - UpdateNote payload', payload });

        const { data } = await hs.call(
            'post',
            'crm/v3/objects/notes',
            payload
        );

        return context.sendJson(data, 'out');
    }
};
