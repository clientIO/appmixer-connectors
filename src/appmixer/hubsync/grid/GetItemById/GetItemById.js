"use strict";

module.exports = {
    async receive(context) {
        const { auth } = context;
        const { workspaceId, databaseId, sheetId } = context.properties;
        const { itemId, itemGlobalId } = context.messages.in.content;

        let url = `${auth.baseUrl}/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets/${sheetId}/items/`;

        if (itemId) {
            url += `${itemId}`;
        } else if (itemGlobalId) {
            url += `globals/${itemGlobalId}`;
        } else {
            throw new context.CancelError('Either itemId or itemGlobalId must be provided (not both).');
        }

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
            return context.sendJson(response.data, 'item');
        } catch (error) {
            throw new Error(`Failed to get item: ${error.message}`);
        }
    }
};