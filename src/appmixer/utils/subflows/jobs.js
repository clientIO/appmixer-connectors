'use strict';

module.exports = async (context) => {

    const config = require('./config')(context);

    // Clean up input (OnFlowCall) and output (FlowCallOutput) definitions for flows that have
    // been deleted. Since we're using the service state to share input and output definitions of
    // subflows with the caller flows, we need to clean up the definitions when the callee
    // flow is deleted.
    await context.scheduleJob('cleanupDefinitionsJob', config.cleanupDefinitions.schedule, async () => {

        try {
            // Input (OnFlowCall) and output (FlowCallOutput) definitions.
            const definitions = await context.db.coreCollection('serviceState')
                .find({ key: /^subflows:/ })
                .limit(config.cleanupDefinitions.batchSize)
                .toArray();
            for (const definition of definitions) {
                const key = definition.key;
                if (key.startsWith('subflows:input:') || key.startsWith('subflows:output:')) {
                    const [,, flowId] = key.split(':');
                    const flow = await context.db.coreCollection('flows').findOne({ flowId });
                    if (!flow) {
                        await context.service.stateUnset(key);
                    }
                }
            }
        } catch (error) {
            await context.log('error', `[UTILS.SUBFLOWS] Error occurred during cleanup job: ${error.message}.`);
        }
    });
};
