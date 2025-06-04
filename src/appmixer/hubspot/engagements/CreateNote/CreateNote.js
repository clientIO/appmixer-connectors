'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {
    async receive(context) {

        const {
            objectId,
            hsNoteBody
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const payload = {
            properties: {
                hs_timestamp: new Date().toISOString(),
                // hubspot_owner_id: ,
                hs_note_body: hsNoteBody
            },
            associations: [
                {
                    to: { id: objectId },
                    types: [
                        {
                            associationCategory: 'HUBSPOT_DEFINED',

                            // contact
                            // associationTypeId: 202  // https://developers.hubspot.com/docs/api/crm/associations#association-type-id-values

                            // deal
                            associationTypeId: 214  // https://developers.hubspot.com/docs/api/crm/associations#association-type-id-values
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

        console.log(JSON.stringify(data, null, 2));
        return context.sendJson(data, 'out');
    }
};