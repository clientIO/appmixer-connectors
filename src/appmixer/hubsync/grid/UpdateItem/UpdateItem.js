'use strict';

const HubSyncClient = require('../../HubSyncClient');
const utils = require('../../utils');

module.exports = {
    async receive(context) {
        const { auth } = context;
        const { workspaceId, databaseId, sheetId } = context.properties;
        const { fields, itemId } = context.messages.in.content;

        // Validate required properties
        if (!workspaceId || !databaseId || !sheetId) {
            throw new context.CancelError('Workspace ID, Database ID, and Sheet ID are required');
        }

        if (!itemId) {
            throw new context.CancelError('Item ID must be provided');
        }

        // Parse fields JSON
        const fieldsObject = utils.parseFields(fields, context);

        const client = new HubSyncClient(auth, context);

        try {
            const updatedItem = await client.updateItem(workspaceId, databaseId, sheetId, itemId, fieldsObject);
            return context.sendJson(updatedItem, 'updatedItem');
        } catch (error) {
            throw new Error(`Failed to update item: ${error.message}`);
        }
    }
};
