'use strict';
const lib = require('../../lib');

module.exports = {
    async tick(context) {
        const databaseId = context.properties.databaseId;

        // Get the last known updated time from the state, or use the current time if not available
        let since = context.state.since || new Date().toISOString();
        let updatedItems = [];

        // Fetch items from the Notion database, sorted by last edited time in descending order
        const response = await lib.callEndpoint(context, `/databases/${databaseId}/query`, {
            method: 'POST',
            data: {
                sorts: [
                    {
                        'timestamp': 'last_edited_time',
                        'direction': 'descending'
                    }
                ]
            }
        });

        // Process each item from the response
        response.data.results.forEach(item => {
            const itemLastEditedTime = item.last_edited_time;

            // Check if the item is updated since the last known update time
            if (itemLastEditedTime > since) {
                updatedItems.push(item);
            }
        });

        // Log current state and updated items for debugging
        context.log({ updatedItems });

        // Send updated items if any
        if (updatedItems.length > 0) {
            await Promise.all(updatedItems.map(updatedItem => context.sendJson(updatedItem, 'out')));
        }

        // Update the state with the latest known update time
        const latestUpdateTime = updatedItems.length > 0 ? updatedItems[0].last_edited_time : since;
        await context.saveState({ since: latestUpdateTime });
    }
};
