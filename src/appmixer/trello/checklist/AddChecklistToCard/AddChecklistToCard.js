'use strict';
const commons = require('../../trello-commons');

module.exports = {

    async receive(context) {

        const { checklistName, checklistItems, boardListCardId } = context.messages.in.content;

        const url = '/1/cards/' + boardListCardId + '/checklists';

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            url: `https://api.trello.com${url}?${commons.getAuthQueryParams(context)}`,
            data: {
                name: checklistName.trim()
            }
        });

        // Add checklist items to the checklist
        if (checklistItems) {
            const items = checklistItems.split('\n');

            if (items.length > 10) {
                throw new context.CancelError('Maximum 10 checklist items are allowed');
            }

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                await context.httpRequest({
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                    url: `https://api.trello.com/1/checklists/${data.id}/checkItems?${commons.getAuthQueryParams(context)}`,
                    data: {
                        'name': item.trim()
                    }
                });
            }

            data.items = items;
        }

        const checklist = {
            ...data,
            name: checklistName,
            idChecklist: data.id
        };

        return context.sendJson(checklist, 'out');
    }
};
