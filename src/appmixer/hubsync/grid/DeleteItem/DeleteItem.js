'use strict';

const HubSyncClient = require('../../HubSyncClient');

module.exports = {
    async receive(context) {
        const { auth } = context;
        const { workspaceId, databaseId, sheetId } = context.properties;
        const { itemId } = context.messages.in.content;

        // Validate required properties
        if (!workspaceId || !databaseId || !sheetId) {
            throw new context.CancelError('Workspace ID, Database ID, and Sheet ID are required');
        }

        if (!itemId) {
            throw new context.CancelError('Item ID must be provided');
        }

        const client = new HubSyncClient(auth, context);

        try {
            await client.deleteItem(workspaceId, databaseId, sheetId, itemId);
            return context.sendJson({ result: true }, 'out');
        } catch (error) {
            throw new Error(`Failed to delete item: ${error.message}`);
        }
    }
};
