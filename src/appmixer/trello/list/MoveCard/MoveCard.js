'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Component for move card to another list
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let cardInfo = context.messages.in.content;
        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let moveCard = Promise.promisify(client.put, { context: client });

        return moveCard(`/1/cards/${cardInfo.boardCardId}?idList=${cardInfo.boardListId}`)
            .then(movedCard => {
                return context.sendJson(movedCard, 'card');
            });
    }
};
