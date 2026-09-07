'use strict';

const lib = require('../../lib');

const schema = {
    appointment_start: { type: 'string', format: 'date-time', title: 'Appointment Start' }
};

/**
 * Cliniko takes plain `YYYY-MM-DD` dates here, but a flow will often pipe a full
 * timestamp in from an upstream component - normalize both forms to a UTC date.
 * @param {object} context
 * @param {string} value
 * @param {string} label
 * @returns {string}
 */
function normalizeDate(context, value, label) {

    const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);

    if (Number.isNaN(parsed.getTime())) {
        throw new context.CancelError(`${label} is not a valid date: ${value}`);
    }

    return parsed.toISOString().slice(0, 10);
}

/**
 * Resolve the date window. Both ends are optional: an empty From means "today" and an
 * empty To means "the end of Cliniko's 7-day maximum", so the common "what is free this
 * week" case needs no date wiring at all.
 * @param {object} context
 * @param {string} fromDate
 * @param {string} toDate
 * @returns {{ from: string, to: string }}
 */
function resolveWindow(context, fromDate, toDate) {

    const todayUtc = new Date().toISOString().slice(0, 10);
    const from = fromDate ? normalizeDate(context, fromDate, 'From') : todayUtc;
    const to = toDate ? normalizeDate(context, toDate, 'To') : addDays(from, 6);

    if (to < from) {
        throw new context.CancelError('To must not be earlier than From.');
    }

    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (24 * 60 * 60 * 1000);

    // Cliniko answers a longer window with a bare 400 - explain it instead.
    if (days > 7) {
        throw new context.CancelError(
            `Cliniko allows at most 7 days between From and To, but the window spans ${days} days. `
            + 'Split the range into smaller windows.'
        );
    }

    // Compared in UTC: the account time zone is not known here, so this catches the
    // clearly-past windows and leaves the same-day edge case to the API.
    if (to < todayUtc) {
        throw new context.CancelError('Available times cannot be queried for dates in the past.');
    }

    return { from, to };
}

/**
 * @param {string} date - YYYY-MM-DD
 * @param {number} days
 * @returns {string}
 */
function addDays(date, days) {

    return new Date(Date.parse(`${date}T00:00:00Z`) + (days * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

/**
 * Build the nested availability path. All three ids are required by Cliniko.
 * @param {object} context
 * @param {object} content
 * @param {string} endpoint - "available_times" or "next_available_time"
 * @returns {string}
 */
function buildPath(context, content, endpoint) {

    const { businessId, practitionerId, appointmentTypeId } = content;

    if (!businessId) {
        throw new context.CancelError('Business is required!');
    }
    if (!practitionerId) {
        throw new context.CancelError('Practitioner is required!');
    }
    if (!appointmentTypeId) {
        throw new context.CancelError('Appointment Type is required!');
    }

    return `/businesses/${encodeURIComponent(businessId)}`
        + `/practitioners/${encodeURIComponent(practitionerId)}`
        + `/appointment_types/${encodeURIComponent(appointmentTypeId)}`
        + `/${endpoint}`;
}

module.exports = {

    async receive(context) {

        const content = context.messages.in.content || {};
        const { outputType = 'array' } = content;

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Available Times' });
        }

        const path = buildPath(context, content, 'available_times');
        const { from, to } = resolveWindow(context, content.fromDate, content.toDate);

        const records = await lib.fetchPage(context, {
            path,
            collection: 'available_times',
            params: { from, to }
        });

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
