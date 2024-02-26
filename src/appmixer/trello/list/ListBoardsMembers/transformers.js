'use strict';

/**
 * Transformer for member of a board
 * @param {Object|string} boardMembers
 */
module.exports.boardMembersToSelectArray = boardMembers => {

    let transformed = [];

    if (Array.isArray(boardMembers)) {
        boardMembers.forEach(member => {

            transformed.push({
                label: member['fullName'],
                value: member['id']
            });
        });
    }

    return transformed;
};
