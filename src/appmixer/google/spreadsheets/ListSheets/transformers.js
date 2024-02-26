'use strict';

/**
 * @param {Object|string} message
 * @param {Object} message.items
 */
module.exports.sheetsToSelectArray = message => {

    var transformed = [];
    if (!message || !message.items) {
        return transformed;
    }

    if (Array.isArray(message.items)) {
        message.items.forEach((sheetItem) => {

            transformed.push({
                label: sheetItem.title,
                value: sheetItem.id.split('/').pop()
            });
        });
    }

    return transformed;
};
