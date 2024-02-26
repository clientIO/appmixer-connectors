'use strict';

/**
 * Transformer for card in list of a board
 * @param {Object|string} cards
 */
module.exports.cardListsToSelectArray = cards => {

    let transformed = [];

    if (Array.isArray(cards)) {
        cards.forEach(card => {

            transformed.push({
                label: card['name'],
                value: card['id']
            });
        });
    }

    return transformed;
};
