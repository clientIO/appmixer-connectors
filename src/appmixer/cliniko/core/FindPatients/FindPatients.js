'use strict';

const lib = require('../../lib');

const schema = {
    id: { type: 'string', title: 'Patient ID' },
    first_name: { type: 'string', title: 'First Name' },
    last_name: { type: 'string', title: 'Last Name' },
    label: { type: 'string', title: 'Full Name' },
    preferred_first_name: { type: 'string', title: 'Preferred First Name' },
    email: { type: 'string', title: 'Email' },
    date_of_birth: { type: 'string', format: 'date', title: 'Date of Birth' },
    sex: { type: 'string', title: 'Sex' },
    gender_identity: { type: 'string', title: 'Gender Identity' },
    title: { type: 'string', title: 'Title' },
    occupation: { type: 'string', title: 'Occupation' },
    medicare: { type: 'string', title: 'Medicare Number' },
    medicare_reference_number: { type: 'string', title: 'Medicare Reference Number' },
    address_1: { type: 'string', title: 'Address Line 1' },
    address_2: { type: 'string', title: 'Address Line 2' },
    address_3: { type: 'string', title: 'Address Line 3' },
    city: { type: 'string', title: 'City' },
    state: { type: 'string', title: 'State' },
    post_code: { type: 'string', title: 'Post Code' },
    country: { type: 'string', title: 'Country' },
    country_code: { type: 'string', title: 'Country Code' },
    notes: { type: 'string', title: 'Notes' },
    appointment_notes: { type: 'string', title: 'Appointment Notes' },
    emergency_contact: { type: 'string', title: 'Emergency Contact' },
    referral_source: { type: 'string', title: 'Referral Source' },
    time_zone: { type: 'string', title: 'Time Zone' },
    accepted_email_marketing: { type: 'boolean', title: 'Accepted Email Marketing' },
    accepted_sms_marketing: { type: 'boolean', title: 'Accepted SMS Marketing' },
    accepted_privacy_policy: { type: 'boolean', title: 'Accepted Privacy Policy' },
    receives_confirmation_emails: { type: 'boolean', title: 'Receives Confirmation Emails' },
    receives_cancellation_emails: { type: 'boolean', title: 'Receives Cancellation Emails' },
    patient_phone_numbers: { type: 'array', title: 'Phone Numbers' },
    archived_at: { type: 'string', format: 'date-time', title: 'Archived At' },
    created_at: { type: 'string', format: 'date-time', title: 'Created At' },
    updated_at: { type: 'string', format: 'date-time', title: 'Updated At' }
};

/**
 * Turn the inspector inputs into Cliniko `q[]` filters.
 * @param {object} content
 * @returns {Array<string>}
 */
function buildFilters({ firstName, lastName, email, dateOfBirth, createdAtFrom, updatedAtFrom, includeArchived }) {

    const filters = [];

    if (firstName) filters.push(`first_name:~${firstName}`);
    if (lastName) filters.push(`last_name:~${lastName}`);
    if (email) filters.push(`email:~${email}`);
    if (dateOfBirth) filters.push(`date_of_birth:=${dateOfBirth}`);
    if (createdAtFrom) filters.push(`created_at:>=${createdAtFrom}`);
    if (updatedAtFrom) filters.push(`updated_at:>=${updatedAtFrom}`);
    // Cliniko hides archived records by default; `archived_at:*` opts them back in.
    if (includeArchived) filters.push('archived_at:*');

    return filters;
}

module.exports = {

    async receive(context) {

        const content = context.messages.in.content || {};
        const { outputType = 'array', isSource } = content;

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Patients' });
        }

        const filters = buildFilters(content);

        // Source call: this component backs every Patient dropdown in the connector, so
        // opening an inspector must not fan out into one live request per field. Cache
        // behind a lock for a short TTL and stay quiet on failure - a dropdown cannot do
        // anything useful with an error.
        if (isSource) {
            const cacheKey = `cliniko_patients_${lib.getBaseUrl(context.auth)}_${context.auth.apiKey}_${filters.join('|')}`;
            let lock;

            try {
                lock = await context.lock(cacheKey);

                const cached = await context.staticCache.get(cacheKey);
                if (cached) {
                    return context.sendJson({ result: cached }, 'out');
                }

                const records = await lib.fetchPage(context, {
                    path: '/patients',
                    collection: 'patients',
                    filters,
                    params: { sort: 'updated_at:desc' }
                });

                // Only the fields the selector needs, to keep the cache small.
                const options = records.map((patient) => ({
                    id: patient.id,
                    label: patient.label,
                    email: patient.email
                }));

                await context.staticCache.set(cacheKey, options, context.config.listCacheTTL || (2 * 60 * 1000));

                return context.sendJson({ result: options }, 'out');
            } catch (error) {
                return context.sendJson({ result: [] }, 'out');
            } finally {
                lock?.unlock();
            }
        }

        const records = await lib.fetchPage(context, {
            path: '/patients',
            collection: 'patients',
            filters,
            params: { sort: 'updated_at:desc' }
        });

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    },

    // Used by the Patient dropdown (source) on every patient-scoped component.
    toSelectArray({ result }) {

        return (result || []).map((patient) => ({
            label: patient.email ? `${patient.label} (${patient.email})` : patient.label || patient.id,
            value: patient.id
        }));
    }
};
