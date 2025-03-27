'use strict';

const { sendArrayOutput, isAppmixerVariable } = require('../../airtable-commons');

module.exports = {

    // Private component used only to list tables in a base in the inspector.
    async receive(context) {

        const {
            generateOutputPortOptions,
            tableId,
            selectedTableFieldsOutput,
            addFields,
            requiredFields,
            returnType
        } = context.properties;
        const { baseId, outputType, isSource } = context.messages.in.content;
        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }
        if (!baseId || isAppmixerVariable(baseId)) {
            // This is the case when component is added to the inspector and user didn't select a base yet.
            // We don't want to throw an error yet.
            return context.sendJson({ items: [] }, 'out');
        }

        const cacheKey = 'airtable_tables_' + baseId;
        let lock;
        try {
            lock = await context.lock(baseId);

            // Checking and returning cache only if this is a call from another component.
            if (isSource) {
                const tablesCached = await context.staticCache.get(cacheKey);
                if (tablesCached) {
                    return context.sendJson({ items: tablesCached }, 'out');
                }
            }

            const { data } = await context.httpRequest.get(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
                headers: {
                    Authorization: `Bearer ${context.auth.accessToken}`
                }
            });
            const { tables } = data;

            // Cache the tables for 20 seconds unless specified otherwise in the config.
            // Note that we only need name and id, so we can save some space in the cache.
            // Caching only if this is a call from another component.
            if (isSource) {
                await context.staticCache.set(
                    cacheKey,
                    tables.map(table => ({ id: table.id, name: table.name })),
                    context.config.listTablesCacheTTL || (20 * 1000)
                );

                return context.sendJson({ items: tables }, 'out');
            }
            if (selectedTableFieldsOutput) {
                if (!tableId) {
                    return context.sendJson([], 'out');
                }

                const selectedTable = tables.filter((table) => table.id === tableId);
                if (!selectedTable.length || !selectedTable[0].fields) {
                    return context.sendJson([], 'out');
                }

                switch (returnType) {
                    case 'outPorts':
                        return context.sendJson({ fields: selectedTable[0].fields, addFields, outputType }, 'out');
                    case 'inPorts':
                        return context.sendJson({ fields: selectedTable[0].fields, addFields, requiredFields }, 'out');
                    default:
                        return context.sendJson([], 'out');
                }
            }
            if (tables.length === 0) {
                return context.sendJson({}, 'notFound');
            }

            // Returning values to the flow.
            await sendArrayOutput({ context, outputType, records: tables });
        } finally {
            lock?.unlock();
        }
    },

    toSelectArray({ items }) {

        return items.map(table => {
            return { label: table.name, value: table.id };
        });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'object' || outputType === 'first') {
            return context.sendJson(
                [
                    { label: 'Current Table Index', value: 'index', schema: { type: 'integer' } },
                    { label: 'Tables Count', value: 'count', schema: { type: 'integer' } },
                    { label: 'Description', value: 'description' },
                    {
                        label: 'Fields', value: 'fields',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    description: { label: 'Description', value: 'description' },
                                    id: { label: 'Field ID', value: 'id' },
                                    name: { label: 'Field Name', value: 'name' },
                                    type: { label: 'Field Type', value: 'type' }
                                }
                            }
                        }
                    },
                    { label: 'Table ID', value: 'id' },
                    { label: 'Table Name', value: 'name' },
                    { label: 'Primary Field ID', value: 'primaryFieldId' },
                    {
                        label: 'Views', value: 'views',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { label: 'View ID', value: 'id' },
                                    name: { label: 'View Name', value: 'name' },
                                    type: { label: 'View Type', value: 'type' }
                                }
                            }
                        }
                    }
                ],
                'out'
            );
        } else if (outputType === 'array') {
            return context.sendJson(
                [
                    { label: 'Tables Count', value: 'count', schema: { type: 'integer' } },
                    {
                        label: 'Tables', value: 'result',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    description: { type: 'string', title: 'Description' },
                                    fields: {
                                        type: 'object', title: 'Fields',
                                        schema: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    description: { label: 'Description', value: 'description' },
                                                    id: { label: 'Field ID', value: 'id' },
                                                    name: { label: 'Field Name', value: 'name' },
                                                    type: { label: 'Field Type', value: 'type' }
                                                }
                                            }
                                        }
                                    },
                                    id: { type: 'string', title: 'Table ID' },
                                    name: { type: 'string', title: 'Table Name' },
                                    primaryFieldId: { type: 'string', title: 'Primary Field ID' },
                                    views: {
                                        type: 'object', title: 'Views',
                                        schema: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    id: { label: 'View ID', value: 'id' },
                                                    name: { label: 'View Name', value: 'name' },
                                                    type: { label: 'View Type', value: 'type' }
                                                }
                                            }
                                        }
                                    }
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
                { label: 'Tables Count', value: 'count', schema: { type: 'integer' } }
            ], 'out');
        }
    }
};
