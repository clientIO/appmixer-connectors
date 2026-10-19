'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { goalId } = context.messages.in.content;
        if (!goalId) {
            throw new context.CancelError('Goal ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        await clickUpClient.request('DELETE', `/goal/${goalId}`);

        return context.sendJson({}, 'out');
    }
};
