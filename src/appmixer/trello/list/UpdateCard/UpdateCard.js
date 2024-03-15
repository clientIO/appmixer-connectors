'use strict';
const commons = require('../../trello-commons');

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

    async receive(context) {

        let cardInfo = context.messages.in.content;
        let boardListCardId = cardInfo.boardListCardId;
        delete cardInfo.boardListCardId;
        const { data: updatedCard } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'PUT',
            url: `https://api.trello.com/1/cards/${boardListCardId}?${commons.getAuthQueryParams(context)}`,
            data: buildCard(cardInfo)
        });

        return context.sendJson(updatedCard, 'card');
    }
};
