'use strict';

module.exports = context => {

    return {
        /** Common for CreateRule and SetBlockIPRule components. */
        ruleDeleteJob: {

            /** Default: every 30sec */
            schedule: context.config.ruleDeleteJobSchedule || '*/30 * * * * *',
            /** Lock TTL, default: 30sec */
            lockTTL: context.config.ruleDeleteJobLockTTL || 30000
        }
    };
};
