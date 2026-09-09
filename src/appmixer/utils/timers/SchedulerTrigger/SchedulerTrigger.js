'use strict';
const moment = require('moment-timezone');
const lib = require('../lib');

const isValidTimezone = (timezone) => {

    return !!moment.tz.zone(timezone);
};

const LAST_DAY_OF_MONTH = 'last day of the month';

// The inspector offers 'last day of the month' plus '1'-'28' only; 29-31 are left out because they
// do not exist in every month. The properties schema cannot express that (the field is
// `["array", "string"]` so that modifiers keep working), so a value coming from an API client or an
// imported flow reaches us unvalidated. moment's set('date', 31) would silently overflow into the
// next month (April 31 -> May 1), turning the schedule into a drifting one, so reject it loudly.
const parseDayOfMonth = (day, context) => {

    if (day === LAST_DAY_OF_MONTH) {
        return LAST_DAY_OF_MONTH;
    }

    const parsed = Number(String(day).trim());
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 28) {
        throw new context.CancelError(
            `Invalid Days of Month value '${day}'. Use a day between 1 and 28, or '${LAST_DAY_OF_MONTH}'.`
        );
    }

    return parsed;
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

    // Flow Test Mode: emit one well-formed schedule payload without setting any timeout or
    // touching state. Reuses the same getNextRun() computation start()/receive() use, so the
    // output shape and the schedule semantics can never drift from production.
    async test(context) {

        const { timezone = 'GMT' } = context.properties;
        if (timezone && !isValidTimezone(timezone)) {
            throw new context.CancelError('Invalid timezone');
        }

        const now = moment().toISOString();
        const nextDate = this.getNextRun(context, { now, previousDate: null, firstTime: true });
        if (!nextDate) {
            throw new Error('No next run within the configured schedule (end date reached).');
        }

        return context.sendJson({
            previousDate: null,
            nextDateGMT: nextDate.toISOString(),
            nextDateLocal: moment(nextDate).tz(timezone).format('YYYY-MM-DDTHH:mm:ss.SSS'),
            timezone
        }, 'out');
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

        // Normalize multiselect fields to array format
        const normalizedDaysOfWeek = daysOfWeek ?
            lib.normalizeMultiselectInput(daysOfWeek, context, 'Days of Week') : [];
        const normalizedDaysOfMonth = daysOfMonth ?
            lib.normalizeMultiselectInput(daysOfMonth, context, 'Days of Month') : [];

        const startLocal = start ? moment.tz(start, 'YYYY-MM-DD HH:mm', timezone) : null;
        const endLocal = end ? moment.tz(end, 'YYYY-MM-DD HH:mm', timezone) : null;
        const nowLocal = moment(now).tz(timezone);

        if (firstTime && startLocal?.isBefore(nowLocal)) {
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
                const daysOfWeekMoments = normalizedDaysOfWeek.map(day => baseDate.clone().set({
                    hour, minute, second: 0, millisecond: 0
                }).day(day.toLowerCase()));

                daysOfWeekMoments.sort((a, b) => a.diff(baseDate) - b.diff(baseDate));
                nextRun = daysOfWeekMoments.find(day => day.isAfter(baseDate)) || daysOfWeekMoments[0].add(1, 'week');
                break;
            case 'months':
                // One candidate per selected day, the same way the `weeks` branch does it for days of
                // the week, so that every ticked day fires and not just the earliest one. 'last day of
                // the month' is one more candidate, resolved against the length of the month it lands
                // in instead of short-circuiting the rest of the selection.
                const daysOfMonthMoments = month => normalizedDaysOfMonth
                    .map(day => parseDayOfMonth(day, context))
                    .map(day => month.clone().set({
                        date: day === LAST_DAY_OF_MONTH ? month.daysInMonth() : day,
                        hour, minute, second: 0, millisecond: 0
                    }))
                    .sort((a, b) => a.diff(b));

                // Nearest candidate after the base date, or else the earliest one next month.
                nextRun = daysOfMonthMoments(baseDate).find(day => day.isAfter(baseDate))
                    || daysOfMonthMoments(baseDate.clone().startOf('month').add(1, 'month'))[0];

                if (!nextRun) {
                    // No day selected. The schema requires daysOfMonth for this schedule type, but the
                    // inspector calls getNextRun() with partial properties while the user is still
                    // configuring, so this has to stay a "nothing to schedule" and not an error.
                    return null;
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
                            nextDateGMT: nextDate ? nextDate.toISOString() : null,
                            nextDateLocal: nextDate ? moment(nextDate).tz(timezone).format('YYYY-MM-DDTHH:mm:ss.SSS') : null,
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

        const { end, timezone = 'GMT' } = context.properties;

        const now = moment().toISOString();
        const nextDate = this.getNextRun(context, { now, firstTime: true });

        context.log({
            step: 'preview',
            nextDateGMT: nextDate ? nextDate.toISOString() : null,
            nextDateLocal: nextDate ? moment(nextDate).tz(timezone).format('YYYY-MM-DDTHH:mm:ss.SSS') : null,
            timezone
        });

        if (nextDate === null && end) {
            throw new Error('No run detected. Please update the end date/time or revise the schedule settings.');
        }

        const inputs = {
            scheduleType: {
                label: 'Repeat',
                // TODO: replace with dynamic tooltip (https://github.com/clientIO/appmixer-fe/issues/4687).
                // tooltip: `Choose how often to repeat the task. ${nextDate.format('HH:mm DD:MM:YYYY')}`,
                tooltip: 'Choose how often to repeat the task.'
            }
        };

        return context.sendJson({ inputs }, 'out');
    }

};
