'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {
    async receive(context) {

        const {
            associationTypeId,
            objectId,
            hsTaskSubject,
            hsTaskBody,
            hsTaskStatus = 'NOT_STARTED',
            hsTaskType = 'TODO',
            hsTimestamp
        } = context.messages.in.content;

        if (!objectId) {
            throw new context.CancelError('Associated Object ID is required!');
        }
        if (!hsTaskSubject) {
            throw new context.CancelError('Task Subject is required!');
        }
        if (!associationTypeId) {
            throw new context.CancelError('Association Type is required!');
        }

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const payload = {
            properties: {
                hs_timestamp: hsTimestamp || new Date().toISOString(),
                hs_task_subject: hsTaskSubject,
                hs_task_body: hsTaskBody || '',
                hs_task_status: hsTaskStatus,
                hs_task_type: hsTaskType
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

        const { data } = await hs.call(
            'post',
            'crm/v3/objects/tasks',
            payload
        );

        return context.sendJson(data, 'out');
    }
};
