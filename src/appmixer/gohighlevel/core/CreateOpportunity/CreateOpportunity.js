'use strict';

const BASE_URL = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

module.exports = {

    async receive(context) {

        if (!context.messages.in.content.pipelineId) {
            throw new context.CancelError('Pipeline is required!');
        }
        if (!context.messages.in.content.name) {
            throw new context.CancelError('Opportunity Name is required!');
        }
        if (!context.messages.in.content.pipelineStageId) {
            throw new context.CancelError('Pipeline Stage ID is required!');
        }
        if (!context.messages.in.content.status) {
            throw new context.CancelError('Status is required!');
        }
        if (!context.messages.in.content.contactId) {
            throw new context.CancelError('Contact ID is required!');
        }

        const {
            pipelineId,
            locationId,
            name,
            pipelineStageId,
            status,
            contactId,
            monetaryValue,
            assignedTo
        } = context.messages.in.content;
        const resolvedLocationId = locationId || context.auth.locationId;

        const body = {
            pipelineId,
            locationId: resolvedLocationId,
            name,
            pipelineStageId,
            status,
            contactId
        };

        if (monetaryValue !== undefined) body.monetaryValue = monetaryValue;
        if (assignedTo !== undefined) body.assignedTo = assignedTo;

        const response = await context.httpRequest({
            method: 'POST',
            url: `${BASE_URL}/opportunities/`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json',
                'Version': API_VERSION
            },
            data: body
        });

        return context.sendJson(response.data.opportunity, 'out');
    }
};
