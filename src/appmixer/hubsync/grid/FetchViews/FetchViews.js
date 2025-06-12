"use strict";
module.exports = {
    async receive(context) {
        const {auth} = context;
        const {workspaceId, databaseId, sheetId, model} = context.messages.in.content;

        const url = `${auth.baseUrl}/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets/${sheetId}/views`;

        try {
            const response = await context.httpRequest({
                method: "GET",
                url,
                headers: {
                    "X-Api-Key": auth.apiKey,
                    "X-Tenant": auth.tenant,
                    "Content-Type": "application/json"
                }
            });
            //console.log('Fetched workspaces:', response.data);
            return context.sendJson(this.viewsToSelectArray(response.data), 'views');
        } catch (error) {
            throw new Error(`Failed to fetch views: ${error.message}`);
        }
    },

    viewsToSelectArray(views) {
        if (views && Array.isArray(views)) {
            return views.map(view => ({
                label: view.title,
                value: view.id
            }));
        }
        return [];
    }
};