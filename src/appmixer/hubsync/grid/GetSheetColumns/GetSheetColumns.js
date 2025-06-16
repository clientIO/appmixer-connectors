
"use strict";
module.exports = {
    async receive(context) {
        const {auth} = context;
        const {workspaceId, databaseId, sheetId} = context.properties;

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

            return context.sendJson(response.data.columns, 'columns');
        } catch (error) {
            throw new Error(`Failed to fetch sheet: ${error.message}`);
        }
    },

    columnsToInspector(columns){
        let inspector = {
            inputs: {},
            groups: {
                columns: {
                    label: "Columns",
                    index: 1
                }
            }
        };
        if (Array.isArray(columns) && columns.length > 0) {

            columns.forEach((column, index) => {
                inspector.inputs[column.id] = {
                    label: column.title,
                    type: "text",
                    group: "columns",
                    index: index + 1
                };
            });
        }
        return inspector;
    }
};