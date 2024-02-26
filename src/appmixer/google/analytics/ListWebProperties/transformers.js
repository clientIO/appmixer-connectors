'use strict';

/**
    @param {Object|string} message
*/
module.exports.webPropertiesToSelectArray = (message) => {

    var transformed = [];

    if (Array.isArray(message.items)) {
        message.items.forEach((webPropertyItem) => {

            const item = {
                label: webPropertyItem.name,
                value: webPropertyItem.id
            };

            transformed.push(item);
        });
    }

    return transformed;
};
