'use strict';

const lib = require('../../lib');

const schema = {
    id: { type: 'string', title: 'Appointment ID' },
    patient_id: { type: 'string', title: 'Patient ID' },
    patient_name: { type: 'string', title: 'Patient Name' },
    practitioner_id: { type: 'string', title: 'Practitioner ID' },
    business_id: { type: 'string', title: 'Business ID' },
    appointment_type_id: { type: 'string', title: 'Appointment Type ID' },
    patient_case_id: { type: 'string', title: 'Patient Case ID' },
    starts_at: { type: 'string', format: 'date-time', title: 'Starts At' },
    ends_at: { type: 'string', format: 'date-time', title: 'Ends At' },
    notes: { type: 'string', title: 'Notes' },
    patient_arrived: { type: 'boolean', title: 'Patient Arrived' },
    did_not_arrive: { type: 'boolean', title: 'Did Not Arrive' },
    cancelled_at: { type: 'string', format: 'date-time', title: 'Cancelled At' },
    cancellation_note: { type: 'string', title: 'Cancellation Note' },
    cancellation_reason: { type: 'integer', title: 'Cancellation Reason' },
    cancellation_reason_description: { type: 'string', title: 'Cancellation Reason Description' },
    email_reminder_sent: { type: 'boolean', title: 'Email Reminder Sent' },
    sms_reminder_sent: { type: 'boolean', title: 'SMS Reminder Sent' },
    invoice_status: { type: 'integer', title: 'Invoice Status' },
    treatment_note_status: { type: 'integer', title: 'Treatment Note Status' },
    telehealth_url: { type: 'string', title: 'Telehealth URL' },
    archived_at: { type: 'string', format: 'date-time', title: 'Archived At' },
    created_at: { type: 'string', format: 'date-time', title: 'Created At' },
    updated_at: { type: 'string', format: 'date-time', title: 'Updated At' }
};

const RELATIONS = ['patient', 'practitioner', 'business', 'appointment_type', 'patient_case'];

/**
 * Turn the inspector inputs into Cliniko `q[]` filters.
 * @param {object} content
 * @returns {Array<string>}
 */
function buildFilters(content) {

    const {
        patientId, practitionerId, businessId, startsAtFrom, startsAtTo,
        createdAtFrom, updatedAtFrom, includeCancelled, includeArchived
    } = content;

    const filters = [];

    if (patientId) filters.push(`patient_id:=${patientId}`);
    if (practitionerId) filters.push(`practitioner_id:=${practitionerId}`);
    if (businessId) filters.push(`business_id:=${businessId}`);
    if (startsAtFrom) filters.push(`starts_at:>=${startsAtFrom}`);
    if (startsAtTo) filters.push(`starts_at:<=${startsAtTo}`);
    if (createdAtFrom) filters.push(`created_at:>=${createdAtFrom}`);
    if (updatedAtFrom) filters.push(`updated_at:>=${updatedAtFrom}`);
    // Cliniko hides cancelled and archived records by default; `:*` opts them back in.
    if (includeCancelled) filters.push('cancelled_at:*');
    if (includeArchived) filters.push('archived_at:*');

    return filters;
}

module.exports = {

    async receive(context) {

        const content = context.messages.in.content || {};
        const { outputType = 'array', isSource } = content;

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Appointments' });
        }

        const filters = buildFilters(content);

        // Source call: keep inspector dropdowns off the live API on every open.
        if (isSource) {
            const cacheKey = `cliniko_appointments_${lib.getBaseUrl(context.auth)}_${context.auth.apiKey}_${filters.join('|')}`;
            let lock;

            try {
                lock = await context.lock(cacheKey);

                const cached = await context.staticCache.get(cacheKey);
                if (cached) {
                    return context.sendJson({ result: cached }, 'out');
                }

                const records = await lib.fetchPage(context, {
                    path: '/individual_appointments',
                    collection: 'individual_appointments',
                    filters,
                    params: { sort: 'starts_at:desc' }
                });

                const options = records.map((appointment) => ({
                    id: appointment.id,
                    patient_name: appointment.patient_name,
                    starts_at: appointment.starts_at
                }));

                await context.staticCache.set(cacheKey, options, context.config.listCacheTTL || (2 * 60 * 1000));

                return context.sendJson({ result: options }, 'out');
            } catch (error) {
                return context.sendJson({ result: [] }, 'out');
            } finally {
                lock?.unlock();
            }
        }

        const records = (await lib.fetchPage(context, {
            path: '/individual_appointments',
            collection: 'individual_appointments',
            filters,
            params: { sort: 'starts_at:desc' }
        })).map((appointment) => lib.expandIds(appointment, RELATIONS));

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    },

    // Used by the Appointment dropdown (source) on appointment-scoped components.
    toSelectArray({ result }) {

        return (result || []).map((appointment) => ({
            label: [appointment.patient_name, appointment.starts_at].filter(Boolean).join(' - ') || appointment.id,
            value: appointment.id
        }));
    }
};
