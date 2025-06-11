"use strict";
module.exports = {
    async receive(context) {
        const {auth} = context;
        const {workspaceId} = context.messages.in.content;

        const url = `${auth.baseUrl}/api/datagrid/workspaces/${workspaceId}/databases`;

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
            return context.sendJson(this.databasesToSelectArray(response.data.items), 'databases');
        } catch (error) {
            throw new Error(`Failed to fetch databases: ${error.message}`);
        }
    },

    databasesToSelectArray(databases) {
        if (databases && Array.isArray(databases)) {
            return databases.map(database => ({
                label: database.title,
                value: database.id
            }));
        }
        return [];
    }
};