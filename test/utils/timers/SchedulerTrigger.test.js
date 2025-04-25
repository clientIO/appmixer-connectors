const assert = require('assert');
const testUtils = require('../../utils.js');
const sinon = require('sinon');
const scheduleTrigger = require('../../../src/appmixer/utils/timers/SchedulerTrigger/SchedulerTrigger.js');
const moment = require('moment');

describe('utils.timers.SchedulerTrigger', () => {

    let context;

    const NOW = new moment('2025-04-25T07:38:12.084Z'); // friday

    beforeEach(async () => {
        // Reset the context
        context = {
            ...testUtils.createMockContext(),
            setTimeout: sinon.spy()
        };
    });

    describe('utils.timers.SchedulerTrigger type months', () => {

        it('test', async () => {
            context.properties = {
                scheduleType: 'months',
                // daysOfMonth: ['last day of the month'],
                // or
                // daysOfMonth: ['2', '8'],
                time: '16:25'
                // it's possible to set a time range. when start is set, the next run should be after start
                // start: '2025-04-29T22:00:00.000Z',
                // it's possible to set a time range. when end is set, the last run should be before end
                // end: '2025-05-29T22:00:00.000Z'

                // when start is not set, the start time is now.
            };
            // TODO
        });

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
                start: '2025-05-01T00:00:00.000Z'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-05-15T16:25:00.000Z', '');
        });

        it('schedule job on the 15th of the month with an end time before the next run', async () => {
            context.properties = {
                scheduleType: 'months',
                daysOfMonth: ['15'],
                time: '16:25',
                end: '2025-05-10T00:00:00.000Z'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun, null, 'Next run should not be scheduled as it exceeds the end time.');
        });

        it('schedule job on the last day of the month with a start and end time', async () => {
            context.properties = {
                scheduleType: 'months',
                daysOfMonth: ['last day of the month'],
                time: '16:25',
                start: '2025-04-01T00:00:00.000Z',
                end: '2025-04-30T23:59:59.000Z'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-30T16:25:00.000Z', '');
        });
    });

    describe('utils.timers.SchedulerTrigger type weeks', () => {

        it('test', async () => {
            context.properties = {
                scheduleType: 'days',
                daysOfWeek: ['monday'],
                time: '16:25'
                // it's possible to set a time range. when start is set, the next run should be after start
                // start: '2025-04-29T22:00:00.000Z',
                // it's possible to set a time range. when end is set, the last run should be before end
                // end: '2025-05-29T22:00:00.000Z'

                // when start is not set, the start time is now.
            };
            // TODO
        });

        it('schedule job on Monday at a specific time', async () => {
            context.properties = {
                scheduleType: 'weeks',
                daysOfWeek: ['monday'],
                time: '16:25'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-28T16:25:00.000Z', '');
        });

        it('schedule job on multiple days of the week at a specific time', async () => {
            context.properties = {
                scheduleType: 'weeks',
                daysOfWeek: ['monday', 'wednesday'],
                time: '16:25'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-28T16:25:00.000Z', '');
        });

        it('schedule job on Sunday with a start time in the future', async () => {
            context.properties = {
                scheduleType: 'weeks',
                daysOfWeek: ['sunday'],
                time: '16:25',
                start: '2025-04-27T00:00:00.000Z'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-27T16:25:00.000Z', '');
        });

        it('schedule job on Friday with an end time before the next run', async () => {
            context.properties = {
                scheduleType: 'weeks',
                daysOfWeek: ['friday'],
                time: '16:25',
                end: '2025-04-25T12:00:00.000Z'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun, null, 'Next run should not be scheduled as it exceeds the end time.');
        });

        it('schedule job on Wednesday with a start and end time', async () => {
            context.properties = {
                scheduleType: 'weeks',
                daysOfWeek: ['wednesday'],
                time: '16:25',
                start: '2025-04-24T00:00:00.000Z',
                end: '2025-05-01T23:59:59.000Z'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-30T16:25:00.000Z', '');
        });
    });

    describe('utils.timers.SchedulerTrigger type days', () => {

        it('schedule job daily at a specific time', async () => {
            context.properties = {
                scheduleType: 'days',
                time: '16:25'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-25T16:25:00.000Z', '');
        });

        it('schedule job daily with a start time in the future', async () => {
            context.properties = {
                scheduleType: 'days',
                time: '16:25',
                start: '2025-04-26T00:00:00.000Z'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-26T16:25:00.000Z', '');
        });

        it('schedule job daily with an end time before the next run', async () => {
            context.properties = {
                scheduleType: 'days',
                time: '16:25',
                end: '2025-04-25T12:00:00.000Z'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun, null, 'Next run should not be scheduled as it exceeds the end time.');
        });

        it('schedule job daily with a start and end time', async () => {
            context.properties = {
                scheduleType: 'days',
                time: '16:25',
                start: '2025-04-25T00:00:00.000Z',
                end: '2025-04-26T23:59:59.000Z'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-25T16:25:00.000Z', '');
        });

        it('schedule job daily with a start time after now', async () => {
            context.properties = {
                scheduleType: 'days',
                time: '16:25',
                start: '2025-04-27T00:00:00.000Z'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-27T16:25:00.000Z', '');
        });
    });

    describe('utils.timers.SchedulerTrigger type custom', () => {

        it('schedule job 2 minute from now', async () => {

            context.properties = {
                scheduleType: 'custom',
                customIntervalUnit: 'minutes',
                customIntervalValue: 2
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-25T07:40:12.084Z', '');
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

            assert.equal(nextRun.toISOString(), '2025-04-25T08:02:00.000Z', '');
        });

        it('schedule job 1 day from a specific start time, before end time', async () => {
            context.properties = {
                scheduleType: 'custom',
                customIntervalUnit: 'days',
                customIntervalValue: 1,
                start: '2025-04-25T08:00:00.000Z',
                end: '2025-04-26T08:00:00.000Z'
            };

            const nextRun = scheduleTrigger.getNextRun(context, { now: NOW });

            assert.equal(nextRun.toISOString(), '2025-04-26T08:00:00.000Z', '');
        });
    });
});

