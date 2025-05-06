'use strict';
// const parser = require('cron-parser');
const moment = require('moment-timezone');

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
            const now = moment().toISOString();
            return this.scheduleJob(context, { now, previousDate, firstTime: false });
        }
    },

    async start(context) {

        const now = moment().toISOString();
        return this.scheduleJob(context, { now, previousDate: null, firstTime: true });
    },

    /**
     *
     * @param context
     * @param now ISO date string
     * @param previousDate ISO date string
     * @param firstTime
     * @returns {moment.Moment|null}
     */
    getNextRun(context, { now, previousDate, firstTime = false }) {

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

        const startLocal = start ? moment.tz(start, 'YYYY-MM-DD HH:mm', timezone) : null;
        const endLocal = end ? moment.tz(end, 'YYYY-MM-DD HH:mm', timezone) : null;
        const nowLocal = moment(now).tz(timezone);

        if (firstTime && startLocal && startLocal.isBefore(nowLocal)) {
            throw new Error(`Start date (${startLocal}) cannot be in the past (now: ${nowLocal}).`);
        }

        if (firstTime && startLocal && endLocal && startLocal.isAfter(endLocal)) {
            throw new Error(`Start date (${startLocal}) cannot be after end: ${endLocal}, now: ${nowLocal}).`);
        }

        const previousDateLocal = previousDate ? moment(previousDate).tz(timezone) : null;
        const hour = parseInt(time.split(':')[0], 10) || 0;
        const minute = parseInt(time.split(':')[1], 10) || 0;
        const baseDate = previousDateLocal || startLocal || nowLocal;

        let nextRun;

        switch (scheduleType) {
            case 'custom':
                if (startLocal && !previousDateLocal) {
                    nextRun = startLocal.clone();
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

                daysOfWeekMoments.sort((a, b) => a.diff(baseDate) - b.diff(baseDate));
                nextRun = daysOfWeekMoments.find(day => day.isAfter(baseDate)) || daysOfWeekMoments[0].add(1, 'week');
                break;
            case 'months':
                const isLastDay = daysOfMonth.includes('last day of the month');
                nextRun = baseDate.clone().set('date', isLastDay ? baseDate.daysInMonth() : Math.min(...daysOfMonth)).set({
                    hour,
                    minute,
                    second: 0,
                    millisecond: 0
                });

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

        if (endLocal && nextRun.isAfter(endLocal)) {
            return null; // Next run exceeds the end time
        }

        return nextRun;
    },

    /**
     * Has to be an atomic operation.
     * @param context
     * @param now
     * @param previousDate
     * @param firstTime
     * @returns {Promise<*>}
     */
    async scheduleJob(context, { now, previousDate = null, firstTime = false }) {

        let lock;
        const { timezone = 'GMT' } = context.properties;
        if (timezone && !isValidTimezone(timezone)) {
            throw new context.CancelError('Invalid timezone');
        }

        try {
            lock = await context.lock(context.componentId);

            const { state, timeoutId } = await context.loadState();

            const nextDate = this.getNextRun(context, { now, previousDate, firstTime });

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
                    if (nextDate && (!firstTime || context.properties.immediate)) {
                        // if the system crashed not, the timeout will be re-delivered into `receive()` method,
                        // the state will be `sendingJson` and now, we need to send json to output port
                        await context.sendJson({
                            previousDate,
                            nextDateGMT: nextDate.toISOString(),
                            nextDateLocal: nextDate.format(),
                            timezone
                        }, 'out');
                    }
                    // state has changed to 'JsonSent', if it crashes at this point, the timeout will be retried,
                    // but the JSON won't be sent again to the output port, instead we will create the followup
                    // timeout
                    await context.stateSet('state', 'JsonSent');

                case 'JsonSent':
                    if (nextDate) {
                        const diff = moment(nextDate).diff(previousDate || now);

                        const newTimeoutId = await context.setTimeout({
                            previousDate: nextDate.toISOString(), firstTime: false
                        }, diff);
                        // the system can crash at this point, timeout is set, but that information won't be stored
                        // in the 'state' and the system will trigger the 'receive()' with the original timeout again,
                        // such case is handled in the "case 'timeoutSet':", see above
                        await context.saveState({ state: 'timeoutSet', timeoutId: newTimeoutId });
                    } else {
                        context.log({ step: 'end', nextDate, end: context.properties.end });
                    }
            }
        } finally {
            if (lock) {
                await lock.unlock();
            }
        }
    },

    generateInspector(context) {

        const { end, timezone } = context.properties;

        const now = moment().toISOString();
        const nextDate = this.getNextRun(context, { now, firstTime: true });

        context.log({
            step: 'preview',
            nextDateGMT: nextDate ? nextDate.toISOString() : null,
            nextDateLocal: nextDate ? nextDate.format() : null,
            timezone: timezone || 'GMT'
        });

        if (nextDate === null && end) {
            throw new Error('No run detected. Please update the end date/time or revise the schedule settings.');
        }

        const inputs = {
            scheduleType: {
                label: 'Repeat',
                // TODO: replace with dynamic tooltip (https://github.com/clientIO/appmixer-fe/issues/4687).
                // tooltip: `Choose how often to repeat the task. ${nextDate}`,
                tooltip: 'Choose how often to repeat the task.'
            }
        };

        return context.sendJson({ inputs }, 'out');
    }

};
