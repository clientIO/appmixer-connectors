'use strict';

module.exports = {
    validateEvents(events) {
        const pattern = /^[A-Za-z][A-Za-z0-9_]*$/;
        const errors = [];

        events.forEach((event, i) => {
            if (event.name.length > 40) {
                errors.push({ EventName: event.name, EventIndex: i + 1, error: 'Name is longer than 40 characters.' });
            }
            if (!pattern.test(event.name)) {
                errors.push({ EventName: event.name, EventIndex: i + 1, error: 'Name can only contain alpha-numeric characters and underscores, and must start with an alphabetic character.' });
            }

            if (event.params) {
                if (event.params.length > 25) {
                    errors.push({ EventName: event.name, EventIndex: i + 1, error: 'Params have more than 25 items.' });
                }
                Object.keys(event.params).forEach((key, j) => {
                    if (key.length > 40) {
                        errors.push({ EventName: event.name, EventIndex: i + 1, ParamsKeyLabel: key, ParamsKeyIndex: j + 1, error: 'Key is longer than 40 characters.' });
                    }
                    if (!pattern.test(key)) {
                        errors.push({ EventName: event.name, EventIndex: i + 1, ParamsKeyLabel: key, ParamsKeyIndex: j + 1, error: 'Key can only contain alpha-numeric characters and underscores, and must start with an alphabetic character.' });
                    }
                });
            }
        });

        return errors;
    }
};
