'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Component for finding specific card of board.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let getRequest = Promise.promisify(client.get, { context: client });
        let { query, boardId } = context.messages.in.content;

        return getRequest(`/1/search?query=${encodeURIComponent(query)}&modelTypes=cards&cards_limit=100`)
            .then(res => {
                if (!res.cards.length) {
                    return context.sendJson({ query }, 'notFound');
                }
                return Promise.map(res.cards, card => {
                    if (boardId && boardId !== '0' && card.idBoard !== boardId) {
                        return;
                    }
                    return context.sendJson(card, 'card');
                });
            });
    }
};
