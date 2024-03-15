'use strict';
const commons = require('../../trello-commons');

/**
 * Component for remove a label from card
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'DELETE',
            url: `https://api.trello.com/1/cards/${context.messages.in.content.boardListCardId}/idLabels/${context.messages.in.content.labelId}?${commons.getAuthQueryParams(context)}`
        });

        return context.sendJson(data, 'out');
    }
};
