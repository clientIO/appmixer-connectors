'use strict';

/**
 * Transformer for board in boards
 * @param {Object|string} boards
 */
module.exports.boardsToSelectArray = boards => {

    let transformed = [];

    if (Array.isArray(boards)) {
        boards.forEach(board => {

            transformed.push({
                label: board['name'],
                value: board['id']
            });
        });
    }

    return transformed;
};
