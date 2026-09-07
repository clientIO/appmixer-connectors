'use strict';

const lib = require('../../lib');

const schema = {
    id: { type: 'string', title: 'Appointment Type ID' },
    name: { type: 'string', title: 'Name' },
    category: { type: 'string', title: 'Category' },
    description: { type: 'string', title: 'Description' },
    duration_in_minutes: { type: 'integer', title: 'Duration (Minutes)' },
    max_attendees: { type: 'integer', title: 'Max Attendees' },
    color: { type: 'string', title: 'Colour' },
    deposit_price: { type: 'string', title: 'Deposit Price' },
    online_bookings_lead_time_hours: { type: 'integer', title: 'Online Bookings Lead Time (Hours)' },
    online_payments_enabled: { type: 'boolean', title: 'Online Payments Enabled' },
    show_in_online_bookings: { type: 'boolean', title: 'Show in Online Bookings' },
    telehealth_enabled: { type: 'boolean', title: 'Telehealth Enabled' },
    archived_at: { type: 'string', format: 'date-time', title: 'Archived At' },
    created_at: { type: 'string', format: 'date-time', title: 'Created At' },
    updated_at: { type: 'string', format: 'date-time', title: 'Updated At' }
};

module.exports = {

    async receive(context) {

        const { outputType = 'array', isSource } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Appointment Types' });
        }

        // Not a source call - hit the API and let errors reach the flow.
        if (!isSource) {
            const records = await lib.fetchPage(context, {
                path: '/appointment_types',
                collection: 'appointment_types'
            });
            return lib.sendArrayOutput({ context, records, outputType });
        }

        // Source call: this component backs the Appointment Type dropdown on most components in
        // the connector. The designer fires those in a burst whenever an inspector opens,
        // so cache behind a lock and render an empty dropdown rather than an error.
        const cacheKey = `cliniko_appointment_types_${lib.getBaseUrl(context.auth)}_${context.auth.apiKey}`;
        let lock;

        try {
            lock = await context.lock(cacheKey);

            const cached = await context.staticCache.get(cacheKey);
            if (cached) {
                return context.sendJson({ result: cached }, 'out');
            }

            const records = await lib.fetchPage(context, {
                path: '/appointment_types',
                collection: 'appointment_types'
            });

            // Only the fields the selector needs, to keep the cache small.
            const options = records.map((record) => ({ id: record.id, label: record.name }));

            await context.staticCache.set(cacheKey, options, context.config.listCacheTTL || (2 * 60 * 1000));

            return context.sendJson({ result: options }, 'out');
        } catch (error) {
            return context.sendJson({ result: [] }, 'out');
        } finally {
            lock?.unlock();
        }
    },

    // Used by the Appointment Type dropdown (source) across the connector.
    toSelectArray({ result }) {

        return (result || []).map((record) => ({
            label: record.label || record.id,
            value: record.id
        }));
    }
};
