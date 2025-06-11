"use strict";
module.exports = {
    async receive(context) {
        const {auth} = context;

        const url = `${auth.baseUrl}/api/common/workspaces/fetch`;

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
                    // You can add any additional parameters here if needed
                }
            });
            //console.log('Fetched workspaces:', response.data);
            return context.sendJson(this.workspacesToSelectArray(response.data.items), 'workspaces');
        } catch (error) {
            throw new Error(`Failed to fetch workspaces: ${error.message}`);
        }
    },

    workspacesToSelectArray(workspaces) {
        if (workspaces && Array.isArray(workspaces)) {
            return workspaces.map(workspace => ({
                label: workspace.title,
                value: workspace.id
            }));
        }
        return [];
    }
};