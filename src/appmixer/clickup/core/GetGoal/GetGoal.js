'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { goalId } = context.messages.in.content;
        if (!goalId) {
            throw new context.CancelError('Goal ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const response = await clickUpClient.request('GET', `/goal/${goalId}`);

        return context.sendJson(response, 'out');
    }
};
