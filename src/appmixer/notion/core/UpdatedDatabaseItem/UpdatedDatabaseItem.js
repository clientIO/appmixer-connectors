'use strict';
const lib = require('../../lib');

module.exports = {
    async tick(context) {
        const databaseId = context.properties.databaseId;

        let since = context.state.since || new Date().toISOString();
        let updatedItems = [];

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

        response.data.results.forEach(item => {
            const itemLastEditedTime = item.last_edited_time;

            if (itemLastEditedTime > since) {
                updatedItems.push(item);
            }
        });

        if (updatedItems.length > 0) {
            await Promise.all(updatedItems.map(updatedItem => context.sendJson(updatedItem, 'out')));
        }

        const latestUpdateTime = updatedItems.length > 0 ? updatedItems[0].last_edited_time : since;
        await context.saveState({ since: latestUpdateTime });
    }
};
