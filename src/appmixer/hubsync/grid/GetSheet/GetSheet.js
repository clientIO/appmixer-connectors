"use strict";
module.exports = {
    async receive(context) {
        const {auth} = context;
        const {workspaceId, databaseId, sheetId} = context.messages.in.content;

        const url = `${auth.baseUrl}/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets/${sheetId}`;

        try {
            const response = await context.httpRequest({
                method: "GET",
                url,
                headers: {
                    "X-Api-Key": auth.apiKey,
                    "X-Tenant": auth.tenant,
                    "Content-Type": "application/json"
                },
                
            });
            return context.sendJson(response.data, 'sheet');
        } catch (error) {
            throw new Error(`Failed to fetch sheet: ${error.message}`);
        }
    },
};