"use strict";

module.exports = {
    async receive(context) {
        const { auth } = context;
        const { workspaceId, databaseId, sheetId } = context.properties;
        const { itemId } = context.messages.in.content;

        if (!itemId) {
            throw new context.CancelError('Item ID must be provided.');
        }


        const url = `${auth.baseUrl}/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets/${sheetId}/items/${itemId}`;
        console .log(`Deleting item at URL: ${url}`);
        try {
            const response = await context.httpRequest({
                method: "DELETE",
                url,
                headers: {
                    "X-Api-Key": auth.apiKey,
                    "X-Tenant": auth.tenant,
                }
            });
            return context.sendJson({
                result: true
            }, 'out');
        } catch (error) {
            throw new Error(`Failed to delete item: ${error.message}`);
        }
    }
};