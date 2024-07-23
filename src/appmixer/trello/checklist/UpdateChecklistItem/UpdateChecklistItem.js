'use strict';

const commons = require('../../trello-commons');

module.exports = {

    async receive(context) {

        const { boardListCardId, checklistItemId, name, state } = context.messages.in.content;

        // Using: https://developer.atlassian.com/cloud/trello/rest/api-group-cards/#api-cards-id-checkitem-idcheckitem-put
        const url = `/1/cards/${boardListCardId}/checkItem/${checklistItemId.trim()}`;

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'PUT',
            url: `https://api.trello.com${url}?${commons.getAuthQueryParams(context)}`,
            data: {
                name: name.trim(),
                state
            }
        });

        return context.sendJson(data, 'out');
    }
};
