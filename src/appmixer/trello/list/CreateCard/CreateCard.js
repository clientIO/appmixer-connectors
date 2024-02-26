'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Build card data.
 * @param {Object} card
 * @param {string} boardListId
 * @return {Object} cardObject
 */
function buildCard(card, boardListId) {

    let cardObject = {
        'name': card['name'],
        'pos': card['position'],
        'idList': boardListId
    };

    cardObject['due'] = card['dueDate'] ? card['dueDate'] : null;
    cardObject['desc'] = card['description'] ? card['description'] : undefined;

    return cardObject;
}

/**
 * Component for adding a card to list of a board
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let cardInfo = context.messages.in.content;
        let boardListId = cardInfo.boardListId;
        delete cardInfo.boardListId;
        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let createCard = Promise.promisify(client.post, { context: client });

        return createCard(
            '/1/cards',
            buildCard(cardInfo, boardListId)
        ).then(newCard => {
            return context.sendJson(newCard, 'card');
        });
    }
};

