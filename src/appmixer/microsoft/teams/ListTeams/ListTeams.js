'use strict';

const lib = require('../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'displayName'],
    properties: {
        id: { type: 'string', title: 'Team ID', example: 'fbe2bf47-16c8-47cf-b4a5-4b9b187c508b' },
        displayName: { type: 'string', title: 'Display Name', example: 'Marketing' },
        description: { type: 'string', title: 'Description', example: 'Team for the marketing department.' },
        isArchived: { type: 'boolean', title: 'Is Archived', example: false },
        tenantId: { type: 'string', title: 'Tenant ID', example: 'b33cbe9f-8ebe-4f2a-912b-7e2a427f477f' }
    }
};

const listTeams = (context) => lib.listAll(context, '/me/joinedTeams');

const toSelectArray = (message) => {

    // Accepts both the current `{ result }` output and the pre-2.0.0 bare array.
    const teams = Array.isArray(message) ? message : (message?.result || []);
    return teams.map((team) => ({ label: team.displayName || team.id, value: team.id }));
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { outputType = 'array', isSource } = context.messages.in.content || {};

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Teams' });
        }

        if (!isSource) {
            const records = await listTeams(context);
            return lib.sendArrayOutput({ context, outputType, records });
        }

        // Source call: backs the Team picker on every Teams component. Render an empty
        // picker instead of an error, the user can still type the Team ID.
        try {
            const options = await lib.callCached(context, 'joinedTeams', async () => {
                const teams = await listTeams(context);
                // Only the fields the picker needs, to keep the cache small.
                return teams.map(({ id, displayName }) => ({ id, displayName }));
            });
            return context.sendJson({ result: options }, 'out');
        } catch (error) {
            return context.sendJson({ result: [] }, 'out');
        }
    },

    toSelectArray,

    // Pre-2.0.0 name of the transform, kept for inspectors that still reference it.
    teamsToSelectArray: toSelectArray
};
