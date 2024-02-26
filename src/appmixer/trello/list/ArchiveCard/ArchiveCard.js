'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Component for archive card
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let cardInfo = context.messages.in.content;
        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let archiveCard = Promise.promisify(client.put, { context: client });

        return archiveCard(`/1/cards/${cardInfo.boardCardId}?closed=true`)
            .then(archivedCard => {
                return context.sendJson(archivedCard, 'card');
            });
    }
};
