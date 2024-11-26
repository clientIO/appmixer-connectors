'use strict';

module.exports = context => {

    return {
        ruleDeleteJob: {

            /** Default: every 10sec */
            schedule: context.config.ruleDeleteJobSchedule || '*/10 * * * * *',
            /** Lock TTL, default: 10sec */
            lockTTL: context.config.ruleDeleteJobLockTTL || 10000,
            /** How many rules delete in one run. */
            batchSize: context.config.ruleDeleteJobBatchSize || 100
        }
    };
};
