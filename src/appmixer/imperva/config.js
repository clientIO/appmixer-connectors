'use strict';

module.exports = context => {

    return {
        /** Common for CreateRule and SetBlockIPRule components. */
        ruleDeleteJob: {

            /** Default: every 10sec */
            schedule: context.config.ruleDeleteJobSchedule || '*/10 * * * * *',
            /** Lock TTL, default: 10sec */
            lockTTL: context.config.ruleDeleteJobLockTTL || 10000
        },
        ruleSelfHealingJob: {
            /** Default: every 5min */
            schedule: context.config.ruleSelfHealingJobSchedule || '0 */5 * * * *',
            /** Lock TTL, default: 10sec */
            lockTTL: context.config.ruleSelfHealingJobLockTTL || 10000
        }
    };
};
