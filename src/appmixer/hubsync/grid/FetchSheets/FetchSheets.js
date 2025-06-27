'use strict';

const HubSyncClient = require('../../HubSyncClient');
const utils = require('../../utils');

module.exports = {
    async receive(context) {
        const { auth } = context;
        const { workspaceId, databaseId } = context.messages.in.content;

        // Validate required properties
        if (!workspaceId || !databaseId) {
            throw new context.CancelError('Workspace ID and Database ID are required');
        }

        const client = new HubSyncClient(auth, context);

        try {
            const sheets = await client.getSheets(workspaceId, databaseId);
            return context.sendJson(sheets, 'sheets');
        } catch (error) {
            throw new Error(`Failed to fetch sheets: ${error.message}`);
        }
    },

    sheetsToSelectArray(sheets) {
        return utils.toSelectArray(sheets);
    }
};
