'use strict';

const HubSyncClient = require('../../HubSyncClient');
const utils = require('../../utils');

module.exports = {
    async receive(context) {
        const { auth } = context;
        const { workspaceId } = context.messages.in.content;

        if (!workspaceId) {
            throw new context.CancelError('Workspace ID is required');
        }

        const client = new HubSyncClient(auth, context);

        try {
            const databases = await client.getDatabases(workspaceId);
            return context.sendJson(databases, 'databases');
        } catch (error) {
            throw new Error(`Failed to fetch databases: ${error.message}`);
        }
    },

    databasesToSelectArray(databases) {
        return utils.toSelectArray(databases);
    }
};
