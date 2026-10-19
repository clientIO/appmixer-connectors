'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { teamId } = context.messages.in.content;

        if (!teamId) {
            throw new context.CancelError('Team ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const response = await clickUpClient.request('POST', `/team/${teamId}/time_entries/stop`);

        return context.sendJson(response, 'out');
    }
};
