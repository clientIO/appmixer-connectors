
'use strict';

const HubSyncClient = require('../../HubSyncClient');
const utils = require('../../utils');

module.exports = {
    async receive(context) {
        const { auth } = context;
        const { workspaceId, databaseId, sheetId, columnId } = context.properties;

        // Validate required properties
        if (!workspaceId || !databaseId || !sheetId || !columnId) {
            throw new context.CancelError('Workspace ID, Database ID, Sheet ID, and Column ID are required');
        }

        const client = new HubSyncClient(auth, context);

        try {
            const sheet = await client.getSheet(workspaceId, databaseId, sheetId);

            const column = sheet.columns.find(col => col.id === columnId);
            if (!column) {
                throw new context.CancelError(`Column with ID ${columnId} not found in sheet ${sheetId}`);
            }

            const choices = column.metadata?.choices || [];

            return context.sendJson(choices, 'choices');
        } catch (error) {
            throw new Error(`Failed to fetch column choices: ${error.message}`);
        }
    },

    columnsToInspector(columns) {
        return utils.columnsToInspector(columns);
    }
};
