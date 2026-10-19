'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { projectId, event, distinctId, properties, timestamp } = context.messages.in.content;

        if (!projectId) {
            throw new context.CancelError('Project is required!');
        }
        if (!event) {
            throw new context.CancelError('Event Name is required!');
        }
        if (!distinctId) {
            throw new context.CancelError('Distinct ID is required!');
        }

        let parsedProperties = {};
        if (properties) {
            try {
                parsedProperties = typeof properties === 'string' ? JSON.parse(properties) : properties;
            } catch (err) {
                throw new context.CancelError('Properties must be a valid JSON object.');
            }
        }

        const apiToken = await lib.getProjectApiToken(context, projectId);

        const payload = {
            'api_key': apiToken,
            event,
            'distinct_id': distinctId,
            properties: parsedProperties
        };
        if (timestamp) {
            payload.timestamp = timestamp;
        }

        const { data } = await context.httpRequest({
            method: 'POST',
            url: `${lib.getBaseUrl(context)}/i/v0/e/`,
            headers: {
                'Content-Type': 'application/json'
            },
            data: payload
        });

        return context.sendJson({ status: data.status, event, distinctId }, 'out');
    }
};
