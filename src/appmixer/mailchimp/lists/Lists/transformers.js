'use strict';

/**
    @param {Object|string} message
*/
module.exports.listsToSelectArray = (message) => {

    const transformed = [];
    if (Array.isArray(message.lists)) {
        message.lists.forEach((listItem) => {

            transformed.push({
                label: listItem.name,
                value: listItem.id
            });
        });
    }

    return transformed;
};
