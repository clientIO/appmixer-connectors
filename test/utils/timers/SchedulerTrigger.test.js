const assert = require('assert');
const testUtils = require('../../utils.js');
const sinon = require('sinon');
const scheduleTrigger = require('../../../src/appmixer/utils/timers/SchedulerTrigger/SchedulerTrigger.js');
const moment = require('moment-timezone');

describe('utils.timers.SchedulerTrigger', () => {

    let context;

    const NOW = '2025-04-25T07:38:12.084Z'; // friday

    beforeEach(async () => {
        // Reset the context
        context = {
            ...testUtils.createMockContext(),
            setTimeout: sinon.spy()
        };
    });

    it('timezones', () => {
        assert.equal(moment(NOW).tz('GMT').toISOString(), '2025-04-25T07:38:12.084Z', 'GMT');
        assert.equal(moment(NOW).tz('GMT').format(), '2025-04-25T07:38:12Z', 'GMT');
        assert.equal(moment(NOW).tz('Europe/Istanbul').format(), '2025-04-25T10:38:12+03:00', 'GMT+3, no summer time');
    });

    describe('utils.timers.SchedulerTrigger type months', () => {

        it('schedule job on the 15th of the month at a specific time', async () => {
            context.properties = {
                scheduleType: 'months',
                daysOfMonth: ['15'],
                time: '16:25'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-05-15T16:25:00.000Z', '');
        });

        it('schedule job on the last day of the month at a specific time', async () => {
            context.properties = {
                scheduleType: 'months',
                daysOfMonth: ['last day of the month'],
                time: '16:25'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-30T16:25:00.000Z', '');
        });

        it('schedule job on multiple days of the month at a specific time', async () => {
            context.properties = {
                scheduleType: 'months',
                daysOfMonth: ['2', '8'],
                time: '16:25'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-05-02T16:25:00.000Z', '');
        });

        it('schedule job on the 15th of the month with a start time in the future', async () => {
            context.properties = {
                scheduleType: 'months',
                daysOfMonth: ['15'],
                time: '16:25',
                start: '2025-05-01 00:00'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-05-15T16:25:00.000Z', '');
        });

        it('schedule job on the 15th of the month with an end time before the next run', async () => {
            context.properties = {
                scheduleType: 'months',
                daysOfMonth: ['15'],
                time: '16:25',
                start: '2025-05-01 00:00'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-05-15T16:25:00.000Z', '');

        });

        it('schedule job on the last day of the month with a start and end time', async () => {
            context.properties = {
                scheduleType: 'months',
                daysOfMonth: ['last day of the month'],
                time: '16:25',
                start: '2025-04-28 00:00',
                end: '2025-04-30 23:59'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-30T16:25:00.000Z', '');
        });
    });

    describe('utils.timers.SchedulerTrigger type weeks', () => {

        it('schedule job on Monday at a specific time', async () => {
            context.properties = {
                scheduleType: 'weeks',
                daysOfWeek: ['monday'],
                time: '16:25'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            console.log(nextRun.toISOString());
            assert.equal(nextRun.toISOString(), '2025-04-28T16:25:00.000Z', 'Monday, 28th April, 16:25');
        });

        it('schedule job on multiple days of the week at a specific time', async () => {
            context.properties = {
                scheduleType: 'weeks',
                daysOfWeek: ['monday', 'wednesday'],
                time: '16:25'
            };

            let nextRun = scheduleTrigger.getNextRun(context, { now: NOW });
            assert.equal(nextRun.toISOString(), '2025-04-28T16:25:00.000Z', '');

        });

        it('schedule job on Sunday with a start time in the future', async () => {
            context.properties = {
                scheduleType: 'weeks',
                daysOfWeek: ['sunday'],
                time: '16:25',
                start: '2025-04-28 00:00'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-27T16:25:00.000Z', '');
        });

        it('schedule job on Friday with an end time before the next run', async () => {
            context.properties = {
                scheduleType: 'weeks',
                daysOfWeek: ['friday'],
                time: '16:25',
                end: '2025-04-25 12:00'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun, null, 'Next run should not be scheduled as it exceeds the end time.');
        });

        it('schedule job on Wednesday with a start and end time', async () => {
            context.properties = {
                scheduleType: 'weeks',
                daysOfWeek: ['wednesday'],
                time: '16:25',
                start: '2025-04-29 00:00',
                end: '2025-05-01 23:59'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-30T16:25:00.000Z', '');
        });
    });

    describe('utils.timers.SchedulerTrigger type days', () => {

        it('schedule job daily at a specific time - starts today ', async () => {

            context.properties = { scheduleType: 'days', time: '16:25' };

            let nextRun = scheduleTrigger.getNextRun(context, { now: NOW });
            assert.equal(nextRun.toISOString(), '2025-04-25T16:25:00.000Z', '1st run ');

            nextRun = scheduleTrigger.getNextRun(context, { now: NOW, previousDate: nextRun.toISOString() });
            assert.equal(nextRun.toISOString(), '2025-04-26T16:25:00.000Z', '2nd run');

            nextRun = scheduleTrigger.getNextRun(context, { now: NOW, previousDate: nextRun.toISOString() });
            assert.equal(nextRun.toISOString(), '2025-04-27T16:25:00.000Z', '3rd run');
        });

        it('schedule job daily at a specific time - starts tomorrow ', async () => {

            context.properties = { scheduleType: 'days', time: '00:25' };

            let nextRun = scheduleTrigger.getNextRun(context, { now: NOW });
            assert.equal(nextRun.toISOString(), '2025-04-26T00:25:00.000Z', '1st run ');

            nextRun = scheduleTrigger.getNextRun(context, { now: NOW, previousDate: nextRun.toISOString() });
            assert.equal(nextRun.toISOString(), '2025-04-27T00:25:00.000Z', '2nd run');

            nextRun = scheduleTrigger.getNextRun(context, { now: NOW, previousDate: nextRun.toISOString() });
            assert.equal(nextRun.toISOString(), '2025-04-28T00:25:00.000Z', '3rd run');
        });

        it('schedule job daily at a specific time - today', async () => {

            context.properties = { scheduleType: 'days', time: '16:25' };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });
            assert.equal(nextRun.toISOString(), '2025-04-25T16:25:00.000Z', '');
        });

        it('schedule job daily at a specific time - next day', async () => {

            context.properties = { scheduleType: 'days', time: '4:15' };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });
            assert.equal(nextRun.toISOString(), '2025-04-26T04:15:00.000Z', '');
        });

        it('schedule job daily at a specific time + timezone', async () => {
            context.properties = { scheduleType: 'days', time: '16:25', timezone: 'Europe/Istanbul' };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });
            assert.equal(nextRun.toISOString(), '2025-04-25T13:25:00.000Z', '');
        });

        it('schedule job daily with a start time in the future', async () => {
            context.properties = {
                scheduleType: 'days',
                time: '16:25',
                start: '2025-05-01 15:30'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-05-01T16:25:00.000Z', '');
        });

        xit('schedule job daily with an end time before the next run', async () => {
            context.properties = {
                scheduleType: 'days',
                time: '16:25',
                end: '2025-06-02 16:40'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun, null, 'Next run should not be scheduled as it exceeds the end time.');
        });

        it('schedule job daily with a start and end time', async () => {
            context.properties = {
                scheduleType: 'days',
                time: '16:25',
                start: '2025-05-01 15:30',
                end: '2025-06-02 16:40'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            console.log(nextRun);
            assert.equal(nextRun.toISOString(), '2025-05-02T16:25:00.000Z', '');
        });

        it('schedule job daily with a start time from start, in Istanbul (GMT+3)', async () => {
            context.properties = {
                scheduleType: 'days',
                time: '16:25',
                start: '2025-05-01 15:30',
                timezone: 'Europe/Istanbul' // GMT+3
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-05-01T13:25:00.000Z', '');
        });
    });

    describe('utils.timers.SchedulerTrigger type custom', () => {

        it('schedule job 2 minute from start', async () => {

            context.properties = {
                scheduleType: 'custom',
                customIntervalUnit: 'minutes',
                customIntervalValue: 2,
                start: '2025-05-01 15:30'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-05-01T15:30:00.000Z', '');
        });

        it('schedule job 2 minute from start, in Istanbul (GMT+3)', async () => {

            context.properties = {
                scheduleType: 'custom',
                customIntervalUnit: 'minutes',
                customIntervalValue: 2,
                start: '2025-05-01 15:30',
                timezone: 'Europe/Istanbul' // GMT+3
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-05-01T12:30:00.000Z', '');
        });

        it('schedule job 2 hours from now', async () => {
            context.properties = {
                scheduleType: 'custom',
                customIntervalUnit: 'hours',
                customIntervalValue: 2
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-25T09:38:12.084Z', '');
        });

        it('schedule job 2 hours from start, in Istanbul time (GMT+3)', async () => {
            context.properties = {
                scheduleType: 'custom',
                customIntervalUnit: 'hours',
                customIntervalValue: 2,
                start: '2025-05-01 15:30',
                timezone: 'Europe/Istanbul' // GMT+3
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-05-01T12:30:00.000Z', '');
        });

        it('schedule job 3 days from now', async () => {
            context.properties = {
                scheduleType: 'custom',
                customIntervalUnit: 'days',
                customIntervalValue: 3
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-28T07:38:12.084Z', '');
        });

        it('schedule job 1 week from now', async () => {
            context.properties = {
                scheduleType: 'custom',
                customIntervalUnit: 'weeks',
                customIntervalValue: 1
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-05-02T07:38:12.084Z', '');
        });

        it('schedule job 2 minutes from a specific start time', async () => {
            context.properties = {
                scheduleType: 'custom',
                customIntervalUnit: 'minutes',
                customIntervalValue: 2,
                start: '2025-04-25T08:00:00.000Z'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-25T08:00:00.000Z', '');
        });

        it('schedule job 1 day from a specific start time, before end time', async () => {
            context.properties = {
                scheduleType: 'custom',
                customIntervalUnit: 'days',
                customIntervalValue: 1,
                start: '2025-04-25T08:00:00.000Z',
                end: '2025-04-28T08:00:00.000Z'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-25T08:00:00.000Z', 'now:' + NOW);
        });
    });
});

