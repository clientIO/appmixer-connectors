'use strict';
// const parser = require('cron-parser');
const moment = require('moment-timezone');

const getExpression = properties => {

    const { minute, hour, dayMonth, dayWeek } = properties;
    return `${minute} ${hour} ${dayMonth} * ${dayWeek}`;
};

const isValidTimezone = (timezone) => {

    return !!moment.tz.zone(timezone);
};

/**
 * @extend {Component}
 */
module.exports = {

    async receive(context) {

        if (context.properties.generateInspector) {
            return this.generateInspector(context);
        }

        if (context.messages.timeout) {
            const previousDate = context.messages.timeout.content.previousDate;
            return this.scheduleJob(context, { previousDate, firstTime: false });
        }
    },

    async start(context) {

        return this.scheduleJob(context, { previousDate: null, firstTime: true });
    },

    /**
     *
     * @param context
     * @param now ISO date string
     * @param previousDate ISO date string
     * @returns {moment.Moment|null}
     */
    getNextRun(context, { now, previousDate }) {

        const {
            scheduleType = 'custom',
            customIntervalUnit,
            customIntervalValue,
            start,
            end,
            daysOfWeek,
            daysOfMonth,
            time = '00:00',
            timezone = 'GMT'
        } = context.properties;

        if (start && moment(start).isBefore(moment(now))) {
            throw new Error(`Start date (${start}) cannot be in the past.`);
        }

        if (start && end && moment(start).isAfter(moment(end))) {
            throw new Error(`Start date (${start}) cannot be after end (${end}).`);
        }

        const startNormalized = start ? moment.tz(start, 'YYYY-MM-DD HH:mm', timezone) : null;
        const endNormalized = end ? moment.tz(end, 'YYYY-MM-DD HH:mm', timezone) : null;
        const previousDateNormalized = previousDate ? moment(previousDate).tz(timezone) : null;
        const hour = parseInt(time.split(':')[0], 10);
        const minute = parseInt(time.split(':')[1], 10);
        const baseDate = previousDateNormalized || startNormalized || moment(now).tz(timezone);

        let nextRun;

        switch (scheduleType) {
            case 'custom':
                if (startNormalized && !previousDateNormalized) {
                    nextRun = startNormalized.clone();
                } else {
                    nextRun = baseDate.clone().add(customIntervalValue, customIntervalUnit);
                }
                break;
            case 'days':
                nextRun = baseDate.clone()
                    .set({ hour, minute, second: 0, millisecond: 0 });

                if (nextRun.isSameOrBefore(baseDate)) {
                    nextRun.add(1, 'day');
                }
                break;
            case 'weeks':
                const daysOfWeekMoments = daysOfWeek.map(day => baseDate.clone().set({
                    hour, minute, second: 0, millisecond: 0
                }).day(day.toLowerCase()));

                nextRun = daysOfWeekMoments.find(day => day.isAfter(baseDate)) || daysOfWeekMoments[0].add(1, 'week');
                break;
            case 'months':
                const isLastDay = daysOfMonth.includes('last day of the month');
                nextRun = baseDate.clone().set('date', isLastDay ?
                    baseDate.daysInMonth() :
                    Math.min(...daysOfMonth)).set({ hour, minute, second: 0, millisecond: 0 });

                if (nextRun.isSameOrBefore(baseDate)) {
                    nextRun.add(1, 'month');
                    if (isLastDay) {
                        nextRun.set('date', nextRun.daysInMonth());
                    }
                }
                break;
            default:
                throw new Error(`Unsupported scheduleType: ${scheduleType}`);
        }

        context.log({
            step: 'debug',
            previousDate,
            baseDate: baseDate.toISOString(),
            nextRunLocalTime: nextRun.format()
        });

        if (endNormalized && nextRun.isAfter(endNormalized)) {
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

            // const now = moment().toISOString();
            // const nextDate = interval.next().toISOString();
            // previousDate = previousDate ? moment(previousDate).toISOString() : null;

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
    }, generateInspector(context) {

        const { scheduleType = 'custom', time, start, end } = context.properties;

        // const nextDate = `<br/>Next run:  <b>${new Date().toISOString()}</b>`;

        const nextRun = this.getNextRun(context, { now: moment().toISOString() });
        context.log({ step: 'inspector', properties: context.properties, nextRun });

        const inputs = {
            scheduleType: {
                group: 'schedule',
                type: 'select',
                index: 0,
                label: 'Repeat', // tooltip: `Choose how often to repeat the task. ${nextDate}`,
                tooltip: 'Choose how often to repeat the task.',
                options: [{
                    label: 'Daily', value: 'days'
                }, {
                    label: 'Days of Week', value: 'weeks'
                }, {
                    label: 'Days of Month', value: 'months'
                }, {
                    label: 'Custom Interval', value: 'custom'
                }]
            }
        };
        return context.sendJson({ inputs }, 'out');
    }

};
