'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    /**
     * This component requires a contact to be associated to the newly created note.
     * TODO: Future versions should allow for other objects, like deals, companies etc to be associated with the note
     * NOTE: A note can also be without associations, but it seems useless as it cannot be found easily.
     */
    async receive(context) {

        const {
            body,
            contactId,
            hubSpotOwnerId,
            attachmentIds,
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const payload = {
            properties: {
                hs_timestamp: (new Date()).toISOString(),
                hs_note_body: body,
                hubspot_owner_id: hubSpotOwnerId || '', // Optional
                hs_attachment_ids: attachmentIds || '' // If multiple the ids must be separated by semi-colons
            },
            associations: [  //TODO: In the future extend to accept other object types than contacts
                {
                    to: {
                       id: contactId
                     },
                     types: [
                       {
                         associationCategory: "HUBSPOT_DEFINED",
                         associationTypeId: 202
                       } ]
                   }
            ]
        };

        const { data } = await hs.call('post', 'crm/v3/objects/notes', payload);

        return context.sendJson(data, 'out');
    }
};
