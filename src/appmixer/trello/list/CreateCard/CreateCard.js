'use strict';
const commons = require('../../trello-commons');

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

    async receive(context) {

        let cardInfo = context.messages.in.content;
        let boardListId = cardInfo.boardListId;
        delete cardInfo.boardListId;
        const { data: newCard } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            url: `https://api.trello.com/1/cards?${commons.getAuthQueryParams(context)}`,
            data: buildCard(cardInfo, boardListId)
        });

        return context.sendJson(newCard, 'card');
    }
};

