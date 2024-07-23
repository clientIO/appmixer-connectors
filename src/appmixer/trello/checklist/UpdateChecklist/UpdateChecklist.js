'use strict';

const commons = require('../../trello-commons');

module.exports = {

    async receive(context) {

        const { checklistId, name } = context.messages.in.content;

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'PUT',
            url: `https://api.trello.com/1/checklists/${checklistId}?${commons.getAuthQueryParams(context)}`,
            data: {
                name: name.trim()
            }
        });

        return context.sendJson(data, 'out');
    }
};
