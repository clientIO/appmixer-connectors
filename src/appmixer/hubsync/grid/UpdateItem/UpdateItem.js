"use strict";

module.exports = {
    async receive(context) {
        const { auth } = context;
        const { workspaceId, databaseId, sheetId, itemId, fields } = context.messages.in.content;

        const url = `${auth.baseUrl}/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets/${sheetId}/items/${itemId}`;

        try {
            const response = await context.httpRequest({
                method: "PUT",
                url,
                headers: {
                    "X-Api-Key": auth.apiKey,
                    "X-Tenant": auth.tenant,
                    "Content-Type": "application/json"
                },
                data: {
                    "itemId": itemId,
                    "fields": fields
                }
            });
            return context.sendJson(response.data, 'updatedItem');
        } catch (error) {
            throw new Error(`Failed to update item: ${error.message}`);
        }
    }
};