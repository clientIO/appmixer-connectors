'use strict';

const { CreateMemoryCommand, ListMemoriesCommand } = require('@aws-sdk/client-bedrock-agentcore-control');
const lib = require('../lib');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Poll ListMemories until the given memory reports ACTIVE. A freshly created
// memory stays in CREATING for roughly a minute and rejects CreateEvent until
// it is ACTIVE, so this lets a flow create a memory and use it in one pass.
async function waitUntilActive(controlClient, memoryId, timeoutMs = 180000, intervalMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        let nextToken;
        let found;
        do {
            const page = await controlClient.send(new ListMemoriesCommand({ maxResults: 100, nextToken }));
            found = (page.memories || []).find(m => m.id === memoryId);
            nextToken = page.nextToken;
        } while (!found && nextToken);

        const status = found && found.status;
        if (status === 'ACTIVE') {
            return found;
        }
        if (status === 'FAILED') {
            throw new Error(`Memory ${memoryId} entered FAILED state.`);
        }
        if (Date.now() >= deadline) {
            throw new Error(`Timed out waiting for memory ${memoryId} to become ACTIVE (last status: ${status || 'unknown'}).`);
        }
        await sleep(intervalMs);
    }
}

module.exports = {

    async receive(context) {

        const {
            name,
            eventExpiryDuration,
            description,
            memoryExecutionRoleArn,
            encryptionKeyArn,
            strategyType,
            strategyName,
            strategyNamespaces,
            waitForActive
        } = context.messages.in.content;

        if (!name) {
            throw new context.CancelError('Name is required!');
        }
        if (eventExpiryDuration === undefined || eventExpiryDuration === null || eventExpiryDuration === '') {
            throw new context.CancelError('Event Expiry Duration is required!');
        }

        const strategyKeyByType = {
            semantic: 'semanticMemoryStrategy',
            summary: 'summaryMemoryStrategy',
            userPreference: 'userPreferenceMemoryStrategy'
        };

        let memoryStrategies;
        if (strategyType) {
            const strategyKey = strategyKeyByType[strategyType];
            if (!strategyKey) {
                throw new context.CancelError(`Unsupported strategy type "${strategyType}".`);
            }
            if (!strategyName) {
                throw new context.CancelError('Strategy Name is required when a Strategy Type is selected!');
            }
            const strategyInput = { name: strategyName };
            const namespaces = (strategyNamespaces || '')
                .split(',')
                .map(ns => ns.trim())
                .filter(ns => ns.length);
            if (namespaces.length) {
                strategyInput.namespaces = namespaces;
            }
            memoryStrategies = [{ [strategyKey]: strategyInput }];
        }

        const { controlClient } = lib.init(context);

        const params = {
            name,
            eventExpiryDuration: parseInt(eventExpiryDuration, 10)
        };
        if (description) {
            params.description = description;
        }
        if (memoryExecutionRoleArn) {
            params.memoryExecutionRoleArn = memoryExecutionRoleArn;
        }
        if (encryptionKeyArn) {
            params.encryptionKeyArn = encryptionKeyArn;
        }
        if (memoryStrategies) {
            params.memoryStrategies = memoryStrategies;
        }

        const response = await controlClient.send(new CreateMemoryCommand(params));
        let memory = response.memory || {};

        if (waitForActive && memory.id) {
            memory = await waitUntilActive(controlClient, memory.id);
        }

        return context.sendJson(memory, 'out');
    }
};
