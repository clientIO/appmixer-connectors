'use strict';
// const parser = require('cron-parser');
const moment = require('moment');

const getExpression = properties => {

    const { minute, hour, dayMonth, dayWeek } = properties;
    return `${minute} ${hour} ${dayMonth} * ${dayWeek}`;
};

const isValidTimezone = (timezone) => {

    return !!moment.tz.zone(timezone);
};

const generateInspector = (context) => {

    const { scheduleType, time, start, end } = context.properties;

    const nextDate = `<br/>Next run:  <b>${new Date().toISOString()}</b>`;
    context.log({ step: 'inspector', properties: context.properties, nextDate });

    const inputs = {
        scheduleType: {
            group: 'schedule',
            type: 'select',
            index: 0,
            label: 'Repeat',
            tooltip: `Choose how often to repeat the task. ${nextDate}`,
            options: [
                {
                    label: 'Daily',
                    value: 'days'
                },
                {
                    label: 'Days of Week',
                    value: 'weeks'
                },
                {
                    label: 'Days of Month',
                    value: 'months'
                },
                {
                    label: 'Custom Interval',
                    value: 'custom'
                }
            ]
        }
    };
    return context.sendJson({ inputs }, 'out');
};

/**
 * @extend {Component}
 */
module.exports = {

    async receive(context) {

        if (context.properties.generateInspector) {
            return generateInspector(context);
        }

        if (context.messages.timeout) {
            const previousDate = context.messages.timeout.content.previousDate;
            return this.scheduleJob(context, { previousDate, firstTime: false });
        }
    },

    async start(context) {

        return this.scheduleJob(context, { previousDate: null, firstTime: true });
    },

    getNextRun(context, { now }) {
        const { scheduleType, customIntervalUnit, customIntervalValue, start, end, daysOfWeek, daysOfMonth, time } = context.properties;

        const startDate = start ? moment(start) : now.clone();
        let nextRun;

        switch (scheduleType) {
            case 'custom':
                nextRun = startDate.clone().add(customIntervalValue, customIntervalUnit);
                break;

            case 'days':
                const hour = parseInt(time.split(':')[0], 10);
                const minute = parseInt(time.split(':')[1], 10);
                console.log(hour, minute);
                nextRun = startDate.clone().set({
                    hour,
                    minute,
                    second: 0,
                    millisecond: 0
                });
                console.log(nextRun.toISOString());
                if (nextRun.isBefore(now)) {
                    nextRun.add(1, 'day');
                }
                break;

            case 'weeks':
                const dayOfWeek = daysOfWeek.map(day => moment().day(day.toLowerCase()));
                nextRun = dayOfWeek.find(day => day.isAfter(now)) || dayOfWeek[0].add(1, 'week');
                nextRun.set({
                    hour: parseInt(time.split(':')[0], 10),
                    minute: parseInt(time.split(':')[1], 10),
                    second: 0,
                    millisecond: 0
                });
                break;

            case 'months':
                const dayOfMonth = daysOfMonth.includes('last day of the month')
                    ? startDate.clone().endOf('month')
                    : startDate.clone().set('date', Math.min(...daysOfMonth));
                nextRun = dayOfMonth.set({
                    hour: parseInt(time.split(':')[0], 10),
                    minute: parseInt(time.split(':')[1], 10),
                    second: 0,
                    millisecond: 0
                });
                if (nextRun.isBefore(now)) {
                    nextRun.add(1, 'month');
                }
                break;

            default:
                throw new Error(`Unsupported scheduleType: ${scheduleType}`);
        }

        if (end && nextRun.isAfter(moment(end))) {
            return null; // Next run exceeds the end time
        }

        return nextRun;
    },

    /**
     * Has to be an atomic operation.
     * @param context
     * @param previousDate
     * @param firstTime
     * @returns {Promise<*>}
     */
    async scheduleJob(context, { now, previousDate = null, firstTime = false }) {

        let lock;
        const { timezone } = context.properties;
        if (timezone && !isValidTimezone(timezone)) {
            throw new context.CancelError('Invalid timezone');
        }

        try {
            lock = await context.lock(context.componentId);

            const expression = getExpression(context.properties);
            const options = timezone ? { tz: timezone } : {};
            const interval = parser.parseExpression(expression, options);
            if (!interval.hasNext()) {
                throw new context.CancelError('Next scheduled date doesn\'t exist');
            }

            const now = moment().toISOString();
            const nextDate = interval.next().toISOString();
            previousDate = previousDate ? moment(previousDate).toISOString() : null;

            const { state, timeoutId } = await context.loadState();

            if (timeoutId && context.messages.timeout.timeoutId !== timeoutId) {
                // handling the case, when timeout has been set, but system crashed, and the timeoutId
                // has not been saved into state, then the `original` timeout has been triggered again(
                // because it did not finish correctly), state was 'JsonSent' and timeout was set
                // for the second time. At this point, two timeouts can be in the DB, but we have
                // to process only one, let's process the one with the same timeoutId as in the 'state'
                return;
            }

            switch (state) {
                case undefined:     // init, called for the first time
                case 'timeoutSet':
                    await context.stateSet('state', 'sendingJson');

                case 'sendingJson':
                    // if previous timeout crashed while sending json to the output port, we don't know if the
                    // json was sent, or not, better to send it twice, than none
                    if (!firstTime || context.properties.immediate) {
                        // if the system crashed not, the timeout will be re-delivered into `receive()` method,
                        // the state will be `sendingJson` and now, we need to send json to output port
                        await context.sendJson({ previousDate, now, nextDate }, 'out');
                    }
                    await context.stateSet('state', 'JsonSent');
                // state has changed to 'JsonSent', if it crashes at this point, the timeout will be retried,
                // but the JSON won't be sent again to the output port, instead we will create the followup
                // timeout

                case 'JsonSent':
                    const diff = moment(nextDate).diff(now);
                    const newTimeoutId = await context.setTimeout({ previousDate: now, firstTime: false }, diff);
                    // the system can crash at this point, timeout is set, but that information won't be stored
                    // in the 'state' and the system will trigger the 'receive()' with the original timeout again,
                    // such case is handled in the "case 'timeoutSet':", see above
                    await context.saveState({ state: 'timeoutSet', timeoutId: newTimeoutId });
            }
        } finally {
            if (lock) {
                await lock.unlock();
            }
        }
    }
};
