'use strict';
const commons = require('../../trello-commons');

/**
 * Process cards to find newly added.
 * @param {Set} knownCards
 * @param {Set} actualCards
 * @param {Set} newCards
 * @param {Object} card
 */
function processCards(knownCards, actualCards, newCards, card) {

    if (knownCards && !knownCards.has(card['id'])) {
        newCards.add(card);
    }
    actualCards.add(card['id']);
}

/**
 * Component which triggers whenever new card is added to a board or to a board list if
 * certain board list is specified.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { boardId, boardListId } = context.properties;

        let url;
        if (boardListId) {
            url = '/1/lists/' + boardListId + '/cards';
        } else {
            url = '/1/boards/' + boardId + '/cards';
        }

        const { data: res } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            url: `https://api.trello.com${url}?${commons.getAuthQueryParams(context)}`
        });
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        res.forEach(processCards.bind(null, known, actual, diff));

        if (diff.size) {
            await Promise.map(diff, card => {
                return context.sendJson(card, 'card');
            });
        }
        await context.saveState({ known: Array.from(actual) });
    }
};

