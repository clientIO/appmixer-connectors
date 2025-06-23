"use strict";

const HubSyncClient = require('../../HubSyncClient');
const utils = require('../../utils');

module.exports = {
    async receive(context) {
        const { auth } = context;
        const { workspaceId, databaseId, sheetId, viewId } = context.properties;
        const { fields, externalId } = context.messages.in.content;
        
        // Validate required properties
        if (!workspaceId || !databaseId || !sheetId || !viewId) {
            throw new context.CancelError('Workspace ID, Database ID, Sheet ID and View ID are required');
        }
        
        // Parse fields JSON
        let fieldsObject = utils.parseFields(fields, context);
        
        // Add globalId to fieldsObject if externalId is provided
        if (externalId) {
            fieldsObject.globalId = externalId;
        }

        const client = new HubSyncClient(auth, context);
        
        try {
            const newItem = await client.createItem(workspaceId, databaseId, sheetId, viewId, fieldsObject);
            return context.sendJson(newItem, 'newItem');
        } catch (error) {
            throw new Error(`Failed to create new item: ${error.message}`);
        }
    }
};