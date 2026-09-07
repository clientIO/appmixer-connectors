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
 * Build the cards listing URL, honoring the optional boardListId filter.
 * @param {Object} properties context.properties
 * @return {string} urlString
 */
function buildUrl({ boardId, boardListId }) {

    return boardListId
        ? '/1/lists/' + boardListId + '/cards'
        : '/1/boards/' + boardId + '/cards';
}

/**
 * Component which triggers whenever new card is added to a board or to a board list if
 * certain board list is specified.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const res = await commons.fetchAll(context, buildUrl(context.properties));
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        res.forEach(processCards.bind(null, known, actual, diff));

        if (diff.size) {
            await Promise.all(Array.from(diff).map(card => {
                return context.sendJson(card, 'card');
            }));
        }
        await context.saveState({ known: Array.from(actual) });
    },

    async test(context) {

        // Same listing request as tick(), honoring the same board/list filter.
        const res = await commons.fetchAll(context, buildUrl(context.properties));
        const latest = commons.pickLatestById(res);
        if (!latest) {
            throw new Error('No recent cards to use as test data.');
        }
        return context.sendJson(latest, 'card');
    }
};

