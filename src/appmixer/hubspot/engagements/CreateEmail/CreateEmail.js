'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {
    async receive(context) {

        const {
            contact_id: contactId,
            hs_timestamp: hsTimestamp,
            hubspot_owner_id: hubspotOwnerId,
            hs_email_direction: hsEmailDirection,
            hs_email_html: hsEmailHtml,
            hs_email_status: hsEmailStatus,
            hs_email_subject: hsEmailSubject,
            hs_email_text: hsEmailText,
            hs_attachment_ids: hsAttachmentIds,
            hs_email_headers: hsEmailHeaders,
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const payload = {
            properties: {
                hs_timestamp: hsTimestamp,
                hubspot_owner_id: hubspotOwnerId,
                hs_email_direction: hsEmailDirection,
                hs_email_html: hsEmailHtml,
                hs_email_status: hsEmailStatus,
                hs_email_subject: hsEmailSubject,
                hs_email_text: hsEmailText,
                hs_attachment_ids: hsAttachmentIds,
                hs_email_headers: hsEmailHeaders
            },
            associations: [
                {
                    to: {
                        id: contactId
                    },
                    types: [
                        {
                            'associationCategory': 'HUBSPOT_DEFINED',
                            'associationTypeId': 198  // https://developers.hubspot.com/docs/api/crm/associations#association-type-id-values
                        }
                    ]
                }
            ]
        };

        context.log({ stage: 'Engagements - CreateEmail payload ', payload });

        const { data } = await hs.call(
            'post',
            '/crm/v3/objects/emails',
            payload
        );

        return context.sendJson(data, 'out');
    }
};
