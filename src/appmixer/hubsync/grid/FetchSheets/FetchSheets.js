"use strict";
module.exports = {
    async receive(context) {
        const {auth} = context;
        const {workspaceId, databaseId} = context.messages.in.content;

        const url = `${auth.baseUrl}/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets`;

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
            return context.sendJson(response.data, 'sheets');
        } catch (error) {
            throw new Error(`Failed to fetch sheets: ${error.message}`);
        }
    },

    sheetsToSelectArray(sheets) {
        if (sheets && Array.isArray(sheets)) {
            return sheets.map(sheet => ({
                label: sheet.title,
                value: sheet.id
            }));
        }
        return [];
    }
};