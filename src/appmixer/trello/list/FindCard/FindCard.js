'use strict';
const commons = require('../../trello-commons');

/**
 * Component for finding specific card of board.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            url: `https://api.trello.com/1/search?query=${encodeURIComponent(context.messages.in.content.query)}&modelTypes=cards&cards_limit=100&${commons.getAuthQueryParams(context)}`
        });
        let { query, boardId } = context.messages.in.content;

        if (data.cards.length === 0) {
            return context.sendJson({ query }, 'notFound');
        }

        for (let card of data.cards) {
            if (boardId && boardId !== '0' && card.idBoard !== boardId) {
                continue;
            }
            context.sendJson(card, 'card');
        }
    }
};
