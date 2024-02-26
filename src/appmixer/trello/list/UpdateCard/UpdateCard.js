'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Build card data.
 * @param {Object} card
 * @return {Object} cardObject
 */
function buildCard(card) {

    let cardObject = {};

    if (card['name']) {
        cardObject.name = card.name;
    }
    if (card['description']) {
        cardObject.desc = card.description;
    }
    if (card['dueDate']) {
        cardObject.due = card.dueDate;
    }
    if (card['position']) {
        cardObject.pos = card.position;
    }
    if (card['subscribed'] && card['subscribed'] === 'true') {
        cardObject.subscribed = true;
    }
    if (card['subscribed'] && card['subscribed'] === 'false') {
        cardObject.subscribed = false;
    }
    if (card['closed'] && card['closed'] === 'true') {
        cardObject.closed = true;
    }
    if (card['closed'] && card['closed'] === 'false') {
        cardObject.closed = false;
    }

    return cardObject;
}

/**
 * Component for update an existing card
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let cardInfo = context.messages.in.content;
        let boardListCardId = cardInfo.boardListCardId;
        delete cardInfo.boardListCardId;
        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let updateCard = Promise.promisify(client.put, { context: client });

        return updateCard(
            '/1/cards/' + boardListCardId,
            buildCard(cardInfo)
        ).then(updatedCard => {
            return context.sendJson(updatedCard, 'card');
        });
    }
};
