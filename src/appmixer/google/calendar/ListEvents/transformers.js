'use strict';

/**
	@param {Object|string} events
*/
module.exports.eventsToSelectArray = events => {

    let transformed = [];

    if (Array.isArray(events.items)) {
        events.items.forEach(event => {
            let item = {
                label: event.summary,
                value: event.id
            };
            transformed.push(item);
        });
    }
    return transformed;
};
