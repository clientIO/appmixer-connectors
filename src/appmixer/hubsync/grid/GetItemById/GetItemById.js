"use strict";

const HubSyncClient = require('../../HubSyncClient');

module.exports = {
    async receive(context) {
        const { auth } = context;
        const { workspaceId, databaseId, sheetId } = context.properties;
        const { itemId, itemGlobalId } = context.messages.in.content;
        
        // Validate required properties
        if (!workspaceId || !databaseId || !sheetId) {
            throw new context.CancelError('Workspace ID, Database ID, and Sheet ID are required');
        }
        
        if (!itemId && !itemGlobalId) {
            throw new context.CancelError('Either itemId or itemGlobalId must be provided');
        }
        
        if (itemId && itemGlobalId) {
            throw new context.CancelError('Please provide either itemId or itemGlobalId, not both');
        }
        
        const client = new HubSyncClient(auth, context);
        
        try {
            let response;
            if (itemId) {
                response = await client.request(
                    'GET',
                    `/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets/${sheetId}/items/${itemId}`,
                    null,
                    'Failed to get item by ID'
                );
            } else {
                response = await client.request(
                    'GET',
                    `/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets/${sheetId}/items/globals/${itemGlobalId}`,
                    null,
                    'Failed to get item by global ID'
                );
            }
            
            return context.sendJson(response, 'item');
        } catch (error) {
            throw new Error(`Failed to get item: ${error.message}`);
        }
    }
};