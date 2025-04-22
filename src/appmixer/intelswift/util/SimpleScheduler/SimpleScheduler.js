const moment = require('moment');

const getLockConfiguration = (context) => {

    return {
        retryDelay: parseInt(context.config.uploadLockRetryDelay, 10) || 3000,
        ttl: parseInt(context.config.uploadLockTtl, 10) || 15 * 60 * 1000,
        maxRetryCount: parseInt(context.config.uploadLockMaxRetryCount, 10) || 60
    };
};

module.exports = {

    async start(context) {

        const { scheduleValue } = context.properties;
        if (scheduleValue) {
            await this.scheduleDrain(context);
            const { nextDate } = await context.loadState();
            await context.log({ step: 'start', nextDate });
        }
    },

    async receive(context) {

        let lock;
        try {

            lock = await context.lock(context.componentId, getLockConfiguration(context));

            if (context.messages.timeout) {
                await this.scheduleDrain(context);
                const { previousDate, nextDate } = await context.loadState();
                await context.sendJson({ previousDate, nextDate }, 'out');
            }

        } finally {
            if (lock) {
                lock.unlock();
            }
        }
    },

    async scheduleDrain(context) {

        const { scheduleValue, scheduleType } = context.properties;
        const now = moment();

        if (!['minutes', 'hours', 'days'].includes(scheduleType)) {
            throw new context.CancelError(`Invalid Schedule Type: ${scheduleType}`);
        }

        if (scheduleValue <= 0) {
            throw new context.CancelError(`Invalid Schedule Value: ${scheduleValue}`);
        }

        const nextDate = now.clone().add(scheduleValue, scheduleType);

        const diff = nextDate.diff(now);
        if (diff <= 0) {
            throw new context.CancelError(`Computed timeout is non‑positive (${diff} ms). Check schedule parameters.`);
        }

        const timeoutId = await context.setTimeout({}, diff);
        await context.saveState({
            timeoutId,
            nextDate: nextDate.toISOString(),
            previousDate: now.toISOString()
        });
    },

    async stop(context) {

        const { timeoutId } = await context.loadState();

        if (timeoutId) {
            context.clearTimeout(timeoutId);
        }
    }
};
