'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { teamId, timeEntryIds, tagName, tagBg, tagFg } = context.messages.in.content;
        if (!teamId) {
            throw new context.CancelError('Team ID is required!');
        }
        if (!timeEntryIds) {
            throw new context.CancelError('Time Entry IDs is required!');
        }
        if (!tagName) {
            throw new context.CancelError('Tag Name is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        await clickUpClient.request('POST', `/team/${teamId}/time_entries/tags`, {
            data: {
                time_entry_ids: timeEntryIds.split(',').map(s => s.trim()),
                tags: [{
                    name: tagName,
                    tag_bg: tagBg || '#000000',
                    tag_fg: tagFg || '#000000'
                }]
            }
        });

        return context.sendJson({}, 'out');
    }
};
