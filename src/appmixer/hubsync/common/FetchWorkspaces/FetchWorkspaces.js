'use strict';

const HubSyncClient = require('../../HubSyncClient');
const utils = require('../../utils');

module.exports = {
    async receive(context) {
        const { auth } = context;
        const client = new HubSyncClient(auth, context);

        try {
            const workspaces = await client.getWorkspaces();
            return context.sendJson(workspaces, 'workspaces');
        } catch (error) {
            throw new Error(`Failed to fetch workspaces: ${error.message}`);
        }
    },

    workspacesToSelectArray(workspaces) {
        return utils.toSelectArray(workspaces);
    }
};
