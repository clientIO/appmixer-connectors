'use strict';

const lib = require('../../lib');

const schema = {
    id: { type: 'string', title: 'Business ID' },
    business_name: { type: 'string', title: 'Business Name' },
    display_name: { type: 'string', title: 'Display Name' },
    label: { type: 'string', title: 'Label' },
    address_1: { type: 'string', title: 'Address Line 1' },
    address_2: { type: 'string', title: 'Address Line 2' },
    city: { type: 'string', title: 'City' },
    state: { type: 'string', title: 'State' },
    post_code: { type: 'string', title: 'Post Code' },
    country: { type: 'string', title: 'Country' },
    country_code: { type: 'string', title: 'Country Code' },
    contact_information: { type: 'string', title: 'Contact Information' },
    website_address: { type: 'string', title: 'Website Address' },
    email_reply_to: { type: 'string', title: 'Reply-To Email' },
    time_zone: { type: 'string', title: 'Time Zone' },
    time_zone_identifier: { type: 'string', title: 'Time Zone Identifier' },
    appointment_reminders_enabled: { type: 'boolean', title: 'Appointment Reminders Enabled' },
    show_in_online_bookings: { type: 'boolean', title: 'Show in Online Bookings' },
    archived_at: { type: 'string', format: 'date-time', title: 'Archived At' },
    created_at: { type: 'string', format: 'date-time', title: 'Created At' },
    updated_at: { type: 'string', format: 'date-time', title: 'Updated At' }
};

module.exports = {

    async receive(context) {

        const { outputType = 'array', isSource } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Businesses' });
        }

        // Not a source call - hit the API and let errors reach the flow.
        if (!isSource) {
            const records = await lib.fetchPage(context, {
                path: '/businesses',
                collection: 'businesses'
            });
            return lib.sendArrayOutput({ context, records, outputType });
        }

        // Source call: this component backs the Business dropdown on most components in
        // the connector. The designer fires those in a burst whenever an inspector opens,
        // so cache behind a lock and render an empty dropdown rather than an error.
        const cacheKey = `cliniko_businesses_${lib.getBaseUrl(context.auth)}_${context.auth.apiKey}`;
        let lock;

        try {
            lock = await context.lock(cacheKey);

            const cached = await context.staticCache.get(cacheKey);
            if (cached) {
                return context.sendJson({ result: cached }, 'out');
            }

            const records = await lib.fetchPage(context, {
                path: '/businesses',
                collection: 'businesses'
            });

            // Only the fields the selector needs, to keep the cache small.
            const options = records.map((record) => ({ id: record.id, label: record.label || record.business_name }));

            await context.staticCache.set(cacheKey, options, context.config.listCacheTTL || (2 * 60 * 1000));

            return context.sendJson({ result: options }, 'out');
        } catch (error) {
            return context.sendJson({ result: [] }, 'out');
        } finally {
            lock?.unlock();
        }
    },

    // Used by the Business dropdown (source) across the connector.
    toSelectArray({ result }) {

        return (result || []).map((record) => ({
            label: record.label || record.id,
            value: record.id
        }));
    }
};
