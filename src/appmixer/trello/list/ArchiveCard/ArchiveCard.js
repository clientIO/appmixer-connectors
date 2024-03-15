'use strict';
const commons = require('../../trello-commons');

/**
 * Component for archive card
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let cardInfo = context.messages.in.content;
        const { data: archivedCard } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'PUT',
            url: `https://api.trello.com/1/cards/${cardInfo.boardCardId}?closed=true&${commons.getAuthQueryParams(context)}`,
            data: {}
        });

        return context.sendJson(archivedCard, 'card');
    }
};
