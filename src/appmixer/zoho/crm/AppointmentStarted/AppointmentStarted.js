'use strict';
const ZohoClient = require('../../ZohoClient');
const lib = require('../lib');

// The Appointments module is only exposed from API v5 up, hence the version override.
const makeClient = (context) => new ZohoClient(context, undefined, { apiVersion: lib.APPOINTMENTS_API_VERSION });

/**
 * Appointments starting in (fromTime, toTime] that were not cancelled - a cancelled appointment
 * never starts. Shared by tick() and test().
 * @param {string|null} fromTime ISO date-time, or null for no lower bound.
 * @param {string} toTime ISO date-time
 */
const startedCriteria = (fromTime, toTime) => lib.buildCriteria([
    fromTime ? `(Appointment_Start_Time:greater_than:${fromTime})` : null,
    `(Appointment_Start_Time:less_equal:${toTime})`,
    `(Status:not_equal:${lib.APPOINTMENT_STATUS_CANCELLED})`
]);

/**
 * Polls the Appointments module and emits every appointment whose start time has passed since the
 * previous tick. The first tick only records the watermark so that past appointments are not
 * replayed into the flow.
 */
module.exports = {

    async tick(context) {

        const now = lib.formatDateTime(new Date());
        const lastCheck = await context.stateGet('lastCheck');

        if (!lastCheck) {
            return context.stateSet('lastCheck', now);
        }

        const records = await makeClient(context).search(lib.APPOINTMENTS_MODULE, {
            criteria: startedCriteria(lastCheck, now),
            fields: lib.APPOINTMENT_FIELDS.join(',')
        });

        for (const record of records) {
            await context.sendJson(record, 'out');
        }

        return context.stateSet('lastCheck', now);
    },

    async test(context) {

        const record = await lib.searchFirst(makeClient(context), lib.APPOINTMENTS_MODULE, {
            criteria: startedCriteria(null, lib.formatDateTime(new Date())),
            fields: lib.APPOINTMENT_FIELDS.join(',')
        });

        if (!record) {
            throw new context.CancelError(
                'No started (past, not cancelled) appointments found to use as test data. ' +
                'The trigger fires once an appointment\'s start time has passed.'
            );
        }

        return context.sendJson(record, 'out');
    }
};
