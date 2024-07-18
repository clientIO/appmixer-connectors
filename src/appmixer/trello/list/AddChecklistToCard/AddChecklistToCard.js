'use strict';
const commons = require('../../trello-commons');

module.exports = {

    async receive(context) {

        const { checklistName, boardListCardId } = context.messages.in.content;

        const url = '/1/cards/' + boardListCardId + '/checklists';

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            url: `https://api.trello.com${url}?${commons.getAuthQueryParams(context)}`,
            data: {
                name: checklistName.trim()
            }
        });

        const checklist = {
            ...data,
            name: checklistName,
            idChecklist: data.id
        };

        return context.sendJson(checklist, 'out');
    }
};
