'use strict';

/**
 * Transformer for list of board
 * @param {Object|string} boardLists
 */
module.exports.boardListsToSelectArray = (boardLists) => {

    let transformed = [];

    if (Array.isArray(boardLists)) {
        boardLists.forEach((list) => {

            transformed.push({
                label: list['name'],
                value: list.id
            });
        });
    }

    return transformed;
};
