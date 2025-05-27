'use strict';

/**
 * Find Leads action.
 * @extends {Component}
 */
module.exports = {
    async receive(context) {
        const generateOutputPortOptions = context.properties.generateOutputPortOptions;

        // Destructure with default values to avoid undefined
        const {
            term = '',
            fields = [],
            exactMatch = false,
            organizationId,
            outputType
        } = context.messages.in.content || {};

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        // Build query params with conditional inclusion
        const params = {
            term,
            exact_match: exactMatch,
            ...(fields && { fields }),
            ...(organizationId && { organization_id: organizationId })
        };

        const result = await context.httpRequest({
            method: 'GET',
            url: 'https://api.pipedrive.com/v1/leads/search',
            headers: {
                'x-api-token': context.auth.apiKey
            },
            params
        });

        if (!result?.data?.success || !result.data.data?.items) {
            throw new context.CancelError(result?.data?.error || 'No leads found');
        }

        const items = result.data.data.items.map(({ item }) => ({
            id: item.id,
            title: item.title,
            owner_id: item.owner?.id || null,
            person_id: item.person?.id || null,
            person_name: item.person?.name || '',
            organization_id: item.organization?.id || null,
            organization_name: item.organization?.name || ''
        }));

        if (items.length === 0) {
            return context.sendJson({ }, 'notFound');
        }

        if (outputType === 'first') {
            return context.sendJson({ lead: items[0], index: 0, count: items.length }, 'out');
        }

        if (outputType === 'array') {
            return context.sendJson({ items, count: items.length }, 'out');
        }

        if (outputType === 'object') {
            for (let index = 0; index < items.length; index++) {
                const lead = items[index];
                await context.sendJson({ lead, index, count: items.length }, 'out');
            }
        }

        if (outputType === 'file') {
            const headers = Object.keys(items[0]);
            const csvRows = [headers.join(',')];
            for (const lead of items) {
                csvRows.push(headers.map(h => `"${(lead[h] ?? '').toString().replace(/"/g, '""')}"`).join(','));
            }
            const csvString = csvRows.join('\n');
            const buffer = Buffer.from(csvString, 'utf8');
            const filename = `pipedrive-findLead-${context.componentId}.csv`;
            const savedFile = await context.saveFileStream(filename, buffer);
            await context.sendJson({ fileId: savedFile.fileId, count: items.length }, 'out');
        }
    },

    getOutputPortOptions(context, outputType) {
        if (outputType === 'first' || outputType === 'object') {
            return context.sendJson([
                { label: 'Current Lead Index', value: 'index', schema: { type: 'integer' } },
                { label: 'Leads Count', value: 'count', schema: { type: 'integer' } },
                { label: 'Lead', value: 'lead', schema: this.leadSchema }
            ], 'out');
        } else if (outputType === 'array') {
            return context.sendJson([
                { label: 'Leads Count', value: 'count', schema: { type: 'integer' } },
                {
                    label: 'Leads',
                    value: 'items',
                    schema: {
                        type: 'array',
                        items: this.leadSchema
                    }
                }
            ], 'out');
        } else { // file
            return context.sendJson([
                { label: 'File ID', value: 'fileId' },
                { label: 'Leads Count', value: 'count', schema: { type: 'integer' } }
            ], 'out');
        }
    },

    leadSchema: {
        type: 'object',
        properties: {
            id: { type: 'string', title: 'Lead ID' },
            title: { type: 'string', title: 'Title' },
            owner_id: { type: ['integer', 'null'], title: 'Owner ID' },
            person_id: { type: ['integer', 'null'], title: 'Person ID' },
            person_name: { type: 'string', title: 'Person Name' },
            organization_id: { type: ['integer', 'null'], title: 'Organization ID' },
            organization_name: { type: 'string', title: 'Organization Name' }
        }
    }
};
