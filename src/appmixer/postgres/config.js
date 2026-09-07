'use strict';

module.exports = context => {

    return {
        asyncPollJob: {
            /** Poll interval. Default: every 5 seconds. */
            schedule: context.config.asyncPollJobSchedule || '*/5 * * * * *',
            /**
             * Distributed lock TTL in ms. Must be long enough to cover one full
             * maintenance run (sync + stale-job recovery), otherwise another node
             * can acquire the lock while the previous run is still executing.
             */
            lockTTL: parseInt(context.config.asyncPollJobLockTTL, 10) || 60000,
            /**
             * A 'running' job whose heartbeat (updatedAt) is older than this (ms)
             * is considered orphaned (its owning node died) and is restarted on
             * another node. Must be several times the poll interval so a live
             * owner is never mistaken for a dead one. Default: 2 minutes.
             */
            staleAfterMs: parseInt(context.config.asyncStaleAfterMs, 10) || 2 * 60 * 1000
        },
        asyncCleanupJob: {
            /** Cleanup orphaned/stuck jobs. Default: every 10 minutes. */
            schedule: context.config.asyncCleanupJobSchedule || '0 */10 * * * *',
            lockTTL: parseInt(context.config.asyncCleanupJobLockTTL, 10) || 15000,
            /** Jobs older than this (ms) that are still 'running' are considered stuck. Default: 24h. */
            stuckThresholdMs: parseInt(context.config.asyncStuckThresholdMs, 10) || 24 * 60 * 60 * 1000
        }
    };
};
