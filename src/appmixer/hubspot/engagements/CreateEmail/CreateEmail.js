'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {
    async receive(context) {

        const {
            contact_id,
            hs_timestamp,
            hubspot_owner_id,
            hs_email_direction,
            hs_email_html,
            hs_email_status,
            hs_email_subject,
            hs_email_text,
            hs_attachment_ids,
            hs_email_headers,
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const payload = {
            properties: {
                hs_timestamp,
                hubspot_owner_id,
                hs_email_direction,
                hs_email_html,
                hs_email_status,
                hs_email_subject,
                hs_email_text,
                hs_attachment_ids,
                hs_email_headers,
            },
            associations: [
                {
                    to: {
                        id: contact_id
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
    },
};
