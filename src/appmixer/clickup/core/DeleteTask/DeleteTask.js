'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { taskId } = context.messages.in.content;

        const clickUpClient = new ClickUpClient(context);

        await clickUpClient.request('DELETE', `/task/${taskId}`);

        return context.sendJson({ taskId }, 'out');
    }
};
