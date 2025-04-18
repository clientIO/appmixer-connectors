'use strict';

const { sendArrayOutput } = require('../../airtable-commons');

module.exports = {

    // Private component used only to list bases in the inspector for other components.
    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { outputType, isSource } = context.messages.in.content;
        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const cacheKey = 'airtable_bases_' + context.auth.accessToken;
        let lock;
        try {
            lock = await context.lock(context.auth.accessToken);

            // Checking and returning cache only if this is a call from another component.
            if (isSource) {
                const basesCached = await context.staticCache.get(cacheKey);
                if (basesCached) {
                    return context.sendJson({ items: basesCached }, 'out');
                }
            }

            const { data } = await context.httpRequest.get('https://api.airtable.com/v0/meta/bases', {
                headers: {
                    Authorization: `Bearer ${context.auth.accessToken}`
                }
            });
            const { bases } = data;

            // Cache the tables for 20 seconds unless specified otherwise in the config.
            // Note that we only need name and id, so we can save some space in the cache.
            // Caching only if this is a call from another component.
            if (isSource) {
                await context.staticCache.set(
                    cacheKey,
                    bases.map(item => ({ id: item.id, name: item.name })),
                    context.config.listBasesCacheTTL || (20 * 1000)
                );

                // Returning values into another component.
                return context.sendJson({ items: bases }, 'out');
            }

            if (bases.length === 0) {
                return context.sendJson({}, 'notFound');
            }

            // Returning values to the flow.
            await sendArrayOutput({ context, outputType, records: bases });
        } finally {
            lock?.unlock();
        }
    },

    toSelectArray({ items }) {

        return items.map(base => {
            return { label: base.name, value: base.id };
        });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'object' || outputType === 'first') {
            return context.sendJson(
                [
                    { label: 'Current Base Index', value: 'index', schema: { type: 'integer' } },
                    { label: 'Bases Count', value: 'count', schema: { type: 'integer' } },
                    { label: 'Base ID', value: 'id' },
                    { label: 'Base Name', value: 'name' },
                    { label: 'Permission Level', value: 'permissionLevel' }
                ],
                'out'
            );
        } else if (outputType === 'array') {
            return context.sendJson(
                [
                    { label: 'Bases Count', value: 'count', schema: { type: 'integer' } },
                    {
                        label: 'Bases', value: 'result',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', title: 'Base ID' },
                                    name: { type: 'string', title: 'Base Name' },
                                    permissionLevel: { type: 'string', title: 'Permission Level' }
                                }
                            }
                        }
                    }
                ],
                'out'
            );
        } else {
            // file
            return context.sendJson([
                { label: 'File ID', value: 'fileId' },
                { label: 'Bases Count', value: 'count', schema: { type: 'integer' } }
            ], 'out');
        }
    }
};
