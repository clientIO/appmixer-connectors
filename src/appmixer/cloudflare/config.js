'use strict';

module.exports = context => {

    return {
        ipDeleteJob: {

            /** Default: every 10sec */
            schedule: context.config.ipDeleteJobSchedule || '*/10 * * * * *',
            /** Lock TTL, default: 10sec */
            lockTTL: context.config.ipDeleteJobLockTTL || 10000
        },
        cleanup: {
            /** Default: every 10min */
            schedule: context.config.cleanupJobSchedule || '0 */10 * * * *',
            /** Lock TTL, default: 10sec */
            lockTTL: context.config.cleanupJobLockTTL || 10000
        }
    };
};
