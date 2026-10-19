'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { taskId, name } = context.messages.in.content;
        if (!taskId) {
            throw new context.CancelError('Task ID is required!');
        }
        if (!name) {
            throw new context.CancelError('Name is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const response = await clickUpClient.request('POST', `/task/${taskId}/checklist`, { data: { name } });

        return context.sendJson(response, 'out');
    }
};
