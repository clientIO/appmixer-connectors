'use strict';

module.exports = {
    async receive(context) {
        const { keys, storeId } = context.messages.in.content;

        let results = [];
        let notFound = [];

        // Iterate through each key object and retrieve the value
        for (const item of keys.AND) {
            const key = item.key;
            const value = await context.store.get(storeId, key);
            if (value.value === null) {
                notFound.push(key);
            } else {
                results.push(value);
            }
        }

        // Send results to 'out' if any results are found
        if (results.length > 0) {
            context.sendJson({ results }, 'out');
        } else if (notFound.length > 0) {
            // Send notFound to 'notFound' if any keys are not found
            context.sendJson({ notFound }, 'notFound');
        } else {
            // If both results and notFound are empty, send keys to 'notFound'
            return context.sendJson({ keys: keys.AND }, 'notFound');
        }

        return context.response();
    }
};
