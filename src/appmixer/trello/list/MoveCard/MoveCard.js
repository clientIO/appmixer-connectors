'use strict';
const commons = require('../../trello-commons');

/**
 * Component for move card to another list
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (!context.messages.in.content.boardCardId) {
            throw new context.CancelError('Card is required!');
        }
        if (!context.messages.in.content.boardListId) {
            throw new context.CancelError('Destination Board List is required!');
        }

        let cardInfo = context.messages.in.content;
        const { data: movedCard } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'PUT',
            url: `https://api.trello.com/1/cards/${cardInfo.boardCardId}?idList=${cardInfo.boardListId}&${commons.getAuthQueryParams(context)}`
        });

        return context.sendJson(movedCard, 'card');
    }
};
