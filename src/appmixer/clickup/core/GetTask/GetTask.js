'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { taskId } = context.messages.in.content;
        if (!taskId) {
            throw new context.CancelError('Task ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const task = await clickUpClient.request('GET', `/task/${taskId}`);

        return context.sendJson(task, 'out');
    }
};
