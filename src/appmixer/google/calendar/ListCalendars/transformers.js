'use strict';

/**
	@param {Object|string} message
*/
module.exports.calendarsToSelectArray = (message) => {

    const transformed = [];

    if (Array.isArray(message.items)) {
        message.items.forEach((calendarItem) => {

            let item = {
                label: calendarItem.summary,
                value: calendarItem.id.split('/').pop()
            };

            if (calendarItem.primary) {
                item['default'] = true;
            }

            transformed.push(item);
        });
    }

    return transformed;
};
