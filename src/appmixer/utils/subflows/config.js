'use strict';

module.exports = context => {

    return {
        cleanupDefinitions: {

            schedule: context.config.cleanupDefinitionsJob || '0 0 */12 * * *',
            batchSize: context.config.cleanupDefinitionsBatchSize || 100
        }
    };
};
