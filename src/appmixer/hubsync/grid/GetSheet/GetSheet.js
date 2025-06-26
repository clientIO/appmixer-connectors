'use strict';

const HubSyncClient = require('../../HubSyncClient');

module.exports = {
    async receive(context) {
        const { auth } = context;
        const { workspaceId, databaseId, sheetId } = context.messages.in.content;

        // Validate required properties
        if (!workspaceId || !databaseId || !sheetId) {
            throw new context.CancelError('Workspace ID, Database ID, and Sheet ID are required');
        }

        const client = new HubSyncClient(auth, context);

        try {
            const sheet = await client.getSheet(workspaceId, databaseId, sheetId);
            return context.sendJson(sheet, 'sheet');
        } catch (error) {
            throw new Error(`Failed to fetch sheet: ${error.message}`);
        }
    }
};
