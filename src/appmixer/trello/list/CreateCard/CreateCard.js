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

        const cardInfo = context.messages.in.content;
        const boardListId = cardInfo.boardListId;
        const checklistName = cardInfo.checklistName?.trim();
        const checklistItems = cardInfo.checklistItems?.trim();

        // Stop execution if checklist name is not provided but checklist items are provided
        if (!checklistName && checklistItems) {
            throw new context.CancelError('Checklist name is required to add checklist items');
        }

        delete cardInfo.boardListId;
        const { data: newCard } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            url: `https://api.trello.com/1/cards?${commons.getAuthQueryParams(context)}`,
            data: buildCard(cardInfo, boardListId)
        });

        // If there is checklist data, add checklist to the card
        if (checklistName) {
            const { data: newChecklist } = await context.httpRequest({
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
                url: `https://api.trello.com/1/checklists?${commons.getAuthQueryParams(context)}`,
                data: {
                    'name': checklistName,
                    'idCard': newCard.id
                }
            });

            // Add checklist items to the checklist
            if (checklistItems) {
                const items = checklistItems.split('\n');

                if (items.length > 5) {
                    throw new context.CancelError('Maximum 5 checklist items are allowed');
                }

                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    await context.httpRequest({
                        headers: { 'Content-Type': 'application/json' },
                        method: 'POST',
                        url: `https://api.trello.com/1/checklists/${newChecklist.id}/checkItems?${commons.getAuthQueryParams(context)}`,
                        data: {
                            'name': item.trim()
                        }
                    });
                }
            }
        }

        return context.sendJson(newCard, 'card');
    }
};

