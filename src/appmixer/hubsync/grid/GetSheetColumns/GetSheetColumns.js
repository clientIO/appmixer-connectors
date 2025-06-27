
'use strict';

const HubSyncClient = require('../../HubSyncClient');
const utils = require('../../utils');

module.exports = {
    async receive(context) {
        const { auth } = context;
        const { workspaceId, databaseId, sheetId } = context.properties;

        // Validate required properties
        if (!workspaceId || !databaseId || !sheetId) {
            throw new context.CancelError('Workspace ID, Database ID, and Sheet ID are required');
        }

        const client = new HubSyncClient(auth, context);

        try {
            const sheet = await client.getSheet(workspaceId, databaseId, sheetId);
            return context.sendJson(sheet.columns, 'columns');
        } catch (error) {
            throw new Error(`Failed to fetch sheet columns: ${error.message}`);
        }
    },

    columnsToInspector(columns) {
        return utils.columnsToInspector(columns);
    },

    columnsToSelectArray(columns) {
        return utils.toSelectArray(columns);
    }
};
