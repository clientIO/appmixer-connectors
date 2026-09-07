'use strict';

const lib = require('../../lib');

const POLL = {
    path: '/individual_appointments',
    collection: 'individual_appointments',
    timestampField: 'cancelled_at',
    relations: ['patient', 'practitioner', 'business', 'appointment_type', 'patient_case']
};

/**
 * Optional practitioner / business narrowing from the trigger's properties.
 * @param {object} properties
 * @returns {Array<string>}
 */
function buildFilters({ practitionerId, businessId }) {

    const filters = [];

    if (practitionerId) filters.push(`practitioner_id:=${practitionerId}`);
    if (businessId) filters.push(`business_id:=${businessId}`);

    return filters;
}

module.exports = {

    async tick(context) {

        const { emit, state } = await lib.pollByTimestamp(context, {
            ...POLL,
            filters: buildFilters(context.properties || {})
        });

        for (const record of emit) {
            await context.sendJson(record, 'out');
        }

        await context.saveState(state);
    },

    // Flow Test Mode: emit the most recent matching record. Read-only, no state writes.
    async test(context) {

        const record = await lib.fetchLatest(context, {
            ...POLL,
            filters: buildFilters(context.properties || {})
        });

        if (!record) {
            throw new Error('No cancelled appointments found to use as test data.');
        }

        return context.sendJson(record, 'out');
    }
};
