'use strict';

module.exports = {
    async receive(context) {
        const { keyValuePairs, storeId } = context.messages.in.content;

        let results = [];

        // Iterate through each key-value pair and store them
        for (const pair of keyValuePairs.AND) {
            const { key, value } = pair;

            // Set the data in the store
            const setData = await context.store.set(storeId, key, value);

            // Collect the response data for each key-value pair
            results.push(Object.assign(setData, {
                key,
                newValue: value
            }));
        }
        // Return the collected results
        return context.sendJson({ results }, 'out');
    }
};
