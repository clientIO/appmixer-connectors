'use strict';
const commons = require('../../trello-commons');

/**
 * Component for move card to another list
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let cardInfo = context.messages.in.content;
        const { data: movedCard } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'PUT',
            url: `https://api.trello.com/1/cards/${cardInfo.boardCardId}?idList=${cardInfo.boardListId}&${commons.getAuthQueryParams(context)}`
        });

        return context.sendJson(movedCard, 'card');
    }
};
