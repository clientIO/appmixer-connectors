'use strict';

const commons = require('../../trello-commons');

module.exports = {

    async receive(context) {

        const { checklistId, checklistItemId } = context.messages.in.content;

        const url = `/1/checklists/${checklistId}/checkItems/${checklistItemId.trim()}`;

        await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'DELETE',
            url: `https://api.trello.com${url}?${commons.getAuthQueryParams(context)}`
        });

        return context.sendJson({}, 'out');
    }
};
