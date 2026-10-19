'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { commentId } = context.messages.in.content;
        if (!commentId) {
            throw new context.CancelError('Comment ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        await clickUpClient.request('DELETE', `/comment/${commentId}`);

        return context.sendJson({}, 'out');
    }
};
