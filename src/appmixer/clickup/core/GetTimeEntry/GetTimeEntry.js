'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { teamId, timeEntryId } = context.messages.in.content;

        if (!teamId) {
            throw new context.CancelError('Team ID is required!');
        }
        if (!timeEntryId) {
            throw new context.CancelError('Time Entry ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const response = await clickUpClient.request('GET', `/team/${teamId}/time_entries/${timeEntryId}`);

        return context.sendJson(response, 'out');
    }
};
