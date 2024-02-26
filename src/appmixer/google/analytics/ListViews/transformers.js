'use strict';

/**
    @param {Object|string} message
*/
module.exports.viewsToSelectArray = (message) => {

    let transformed = [];

    if (Array.isArray(message.items)) {
        message.items.forEach((viewItem) => {

            const item = {
                label: viewItem.name,
                value: viewItem.id
            };

            transformed.push(item);
        });
    }

    return transformed;
};
