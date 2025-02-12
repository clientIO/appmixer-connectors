'use strict';
const commons = require('../lib');

module.exports = {
    async receive(context) {
        const { label, createButton } = context.messages.in.content;

        const endpoint = '/users/me/labels';
        const response = await commons.callEndpoint(context, endpoint, {
            headers: { 'Content-Type': 'application/json' }
        });

        const labels = response.data.labels;
        const foundLabel = labels.find(l => l.name.toLowerCase() === label.toLowerCase());

        if (foundLabel) {
            return context.sendJson(foundLabel, 'out');
        } else if (createButton) {
            const createEndpoint = '/users/me/labels';
            const createResponse = await commons.callEndpoint(context, createEndpoint, {
                method: 'POST',
                data: { name: label },
                headers: { 'Content-Type': 'application/json' }
            });

            return context.sendJson(createResponse.data, 'out');
        } else {

            return context.send('Label not found', 'notFound');
        }
    }
};
