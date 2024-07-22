'use strict';

const commons = require('../../trello-commons');

module.exports = {

    async receive(context) {

        const { checklistId, checklistItem, boardListCardId } = context.messages.in.content;

        const url = `/1/checklists/${checklistId}/checkItems`;

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            url: `https://api.trello.com${url}?${commons.getAuthQueryParams(context)}`,
            data: {
                name: checklistItem.trim()
            }
        });

        const checklist = {
            ...data,
            boardListCardId
        };

        return context.sendJson(checklist, 'out');
    }
};
