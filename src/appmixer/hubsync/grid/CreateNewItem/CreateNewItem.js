"use strict";

module.exports = {
    async receive(context) {
        const { auth } = context;
        const { workspaceId, databaseId, sheetId, viewId } = context.properties;
        const { fields } = context.messages.in.content;
       
        let fieldsObject = {};
        try {
            fieldsObject = JSON.parse(fields);
        } catch (error) {
            throw new context.CancelError('Invalid fields JSON');
        }

        const url = `${auth.baseUrl}/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets/${sheetId}/items`;
        try {
            const response = await context.httpRequest({
                method: "POST",
                url,
                headers: {
                    "X-Api-Key": auth.apiKey,
                    "X-Tenant": auth.tenant,
                    "Content-Type": "application/json"
                },
                data: {
                    "viewId": viewId,
                    "fields": fieldsObject
                }
            });
            return context.sendJson(response.data, 'newItem');
        } catch (error) {
            throw new Error(`Failed to create new item: ${error.message}`);
        }
    }
};