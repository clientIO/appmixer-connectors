"use strict";

module.exports = {
    async receive(context) {
        const { auth } = context;
        const { workspaceId, databaseId, sheetId } = context.properties;
        const { fields, itemId } = context.messages.in.content;

        let fieldsObject = {};
        try {
            fieldsObject = JSON.parse(fields);
        } catch (error) {
            throw new context.CancelError("Invalid fields JSON");
        }

        if (!itemId) {
            throw new context.CancelError("Item ID must be provided.");
        }

        const url = `${auth.baseUrl}/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets/${sheetId}/items/${itemId}`;

        const response = await context.httpRequest({
            method: "PUT",
            url,
            headers: {
                "X-Api-Key": auth.apiKey,
                "X-Tenant": auth.tenant,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            data: {
                fields: fieldsObject,
            },
        });
        return context.sendJson(response.data, "updatedItem");
    },
};
