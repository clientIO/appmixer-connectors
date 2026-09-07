'use strict';

const lib = require('../../lib');

const schema = {
    id: { type: 'string', title: 'Practitioner ID' },
    first_name: { type: 'string', title: 'First Name' },
    last_name: { type: 'string', title: 'Last Name' },
    label: { type: 'string', title: 'Full Name' },
    display_name: { type: 'string', title: 'Display Name' },
    title: { type: 'string', title: 'Title' },
    designation: { type: 'string', title: 'Designation' },
    description: { type: 'string', title: 'Description' },
    active: { type: 'boolean', title: 'Active' },
    show_in_online_bookings: { type: 'boolean', title: 'Show in Online Bookings' },
    user_id: { type: 'string', title: 'User ID' },
    created_at: { type: 'string', format: 'date-time', title: 'Created At' },
    updated_at: { type: 'string', format: 'date-time', title: 'Updated At' }
};

module.exports = {

    async receive(context) {

        const { outputType = 'array', isSource } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Practitioners' });
        }

        // Not a source call - hit the API and let errors reach the flow.
        if (!isSource) {
            const records = (await lib.fetchPage(context, {
                path: '/practitioners',
                collection: 'practitioners'
            })).map((practitioner) => lib.expandIds(practitioner, ['user']));
            return lib.sendArrayOutput({ context, records, outputType });
        }

        // Source call: this component backs the Practitioner dropdown on most components in
        // the connector. The designer fires those in a burst whenever an inspector opens,
        // so cache behind a lock and render an empty dropdown rather than an error.
        const cacheKey = `cliniko_practitioners_${lib.getBaseUrl(context.auth)}_${context.auth.apiKey}`;
        let lock;

        try {
            lock = await context.lock(cacheKey);

            const cached = await context.staticCache.get(cacheKey);
            if (cached) {
                return context.sendJson({ result: cached }, 'out');
            }

            const records = (await lib.fetchPage(context, {
                path: '/practitioners',
                collection: 'practitioners'
            })).map((practitioner) => lib.expandIds(practitioner, ['user']));

            // Only the fields the selector needs, to keep the cache small.
            const options = records.map((record) => ({ id: record.id, label: record.label || record.display_name }));

            await context.staticCache.set(cacheKey, options, context.config.listCacheTTL || (2 * 60 * 1000));

            return context.sendJson({ result: options }, 'out');
        } catch (error) {
            return context.sendJson({ result: [] }, 'out');
        } finally {
            lock?.unlock();
        }
    },

    // Used by the Practitioner dropdown (source) across the connector.
    toSelectArray({ result }) {

        return (result || []).map((record) => ({
            label: record.label || record.id,
            value: record.id
        }));
    }
};
