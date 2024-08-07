'use strict';

module.exports = {
    async tick(context) {
        const databaseId = context.properties.databaseId;
        const authHeader = `Bearer ${context.auth.accessToken}`;
        const apiVersion = '2022-06-28';
        let newState = {};
        let knownItems = new Set(context.state.known || []);

        const response = await context.httpRequest({
            method: 'POST',
            url: `https://api.notion.com/v1/databases/${databaseId}/query`,
            headers: {
                'Authorization': authHeader,
                'Notion-Version': apiVersion,
                'Content-Type': 'application/json'
            },
            data: {
                sorts: [
                    {
                        "timestamp": 'created_time',
                        "direction": 'descending'
                    }
                ]
            }
        });

        const currentItems = [];
        const newItems = [];

        response.data.results.forEach(item => {
            currentItems.push(item.id);
            if (!knownItems.has(item.id)) {
                if (context.state.known) { // Only consider it new if state.known is already set
                    newItems.push(item);
                }
            }
        });

        newState.known = currentItems;

        await context.saveState(newState);

        if (context.state.known) { // Only send new items if state.known is already set
            await Promise.all(newItems.map(newItem => context.sendJson(newItem, 'out')));
        }
    }
};
