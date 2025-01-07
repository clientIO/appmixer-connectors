'use strict';

module.exports = context => {

    return {
        /** Used in SetBlockIPRule component. */
        ruleDeleteJob: {

            /** Default: every 10sec */
            schedule: context.config.ruleDeleteJobSchedule || '*/10 * * * * *',
            /** Lock TTL, default: 10sec */
            lockTTL: context.config.ruleDeleteJobLockTTL || 10000
        }
    };
};
