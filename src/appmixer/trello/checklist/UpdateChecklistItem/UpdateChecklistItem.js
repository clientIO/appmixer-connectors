'use strict';

const commons = require('../../trello-commons');

module.exports = {

    async receive(context) {

        if (!context.messages.in.content.boardListCardId) {
            throw new context.CancelError('Card is required!');
        }
        if (!context.messages.in.content.checklistItemId) {
            throw new context.CancelError('Checklist Item is required!');
        }
        if (!context.messages.in.content.name) {
            throw new context.CancelError('Checklist Item Name is required!');
        }

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
