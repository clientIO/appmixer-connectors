'use strict';

module.exports = {
    async tick(context) {
        const databaseId = context.properties.databaseId;
        const authHeader = `Bearer ${context.auth.accessToken}`;
        const apiVersion = '2022-06-28';
        let newState = context.state.lastKnownState || {};

        const response = await context.httpRequest({
            method: 'POST',
            url: `https://api.notion.com/v1/databases/${databaseId}/query`,
            headers: {
                'Authorization': authHeader,
                'Notion-Version': apiVersion,
                'Content-Type': 'application/json'
            }
        });

        const newItems = response.data.results.filter(item => {
            return new Date(item.created_time) > new Date(newState.lastCheckTime || 0);
        });

        for (const newItem of newItems) {
            await context.sendJson(newItem, 'out');
        }

        newState.lastCheckTime = new Date().toISOString();
        await context.saveState(newState);
    }
};
