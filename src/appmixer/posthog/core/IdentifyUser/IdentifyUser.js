'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { projectId, distinctId, properties } = context.messages.in.content;

        if (!projectId) {
            throw new context.CancelError('Project is required!');
        }
        if (!distinctId) {
            throw new context.CancelError('Distinct ID is required!');
        }

        let parsedProperties = {};
        if (properties) {
            try {
                parsedProperties = typeof properties === 'string' ? JSON.parse(properties) : properties;
            } catch (err) {
                throw new context.CancelError('Person Properties must be a valid JSON object.');
            }
        }

        const apiToken = await lib.getProjectApiToken(context, projectId);

        const { data } = await context.httpRequest({
            method: 'POST',
            url: `${lib.getBaseUrl(context)}/i/v0/e/`,
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
                'api_key': apiToken,
                event: '$identify',
                'distinct_id': distinctId,
                properties: {
                    '$set': parsedProperties
                }
            }
        });

        return context.sendJson({ status: data.status, distinctId }, 'out');
    }
};
