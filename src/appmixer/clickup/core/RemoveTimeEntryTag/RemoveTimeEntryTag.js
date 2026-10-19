'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { teamId, timeEntryIds, tagNames } = context.messages.in.content;
        if (!teamId) {
            throw new context.CancelError('Team ID is required!');
        }
        if (!timeEntryIds) {
            throw new context.CancelError('Time Entry IDs is required!');
        }
        if (!tagNames) {
            throw new context.CancelError('Tag Names is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        await clickUpClient.request('DELETE', `/team/${teamId}/time_entries/tags`, {
            data: {
                time_entry_ids: timeEntryIds.split(',').map(s => s.trim()),
                tags: tagNames.split(',').map(s => s.trim())
            }
        });

        return context.sendJson({}, 'out');
    }
};
