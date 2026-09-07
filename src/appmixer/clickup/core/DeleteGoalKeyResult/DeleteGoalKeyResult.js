'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { keyResultId } = context.messages.in.content;
        if (!keyResultId) {
            throw new context.CancelError('Key Result ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        await clickUpClient.request('DELETE', `/key_result/${keyResultId}`);

        return context.sendJson({}, 'out');
    }
};
