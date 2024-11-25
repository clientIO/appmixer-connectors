'use strict';

const searchOutput = require('../../searchOutput');

const outputPortName = 'out';

/**
 * FindDeal action.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { generateOutputPortOptions } = context.properties;
        const { term, personId, exactMatch, orgId, status, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const queryParams = {
            term,
            person_id: personId,
            status,
            exact_match: exactMatch,
            organization_id: orgId,
            limit: outputType === 'first' ? 1 : 100
        };

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.pipedrive.com/v1/deals/search',
            headers: {
                'x-api-token': `${context.auth.apiKey}`
            },
            params: queryParams
        });

        if (data.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        const responseData = data.data.items.map((item) => {
            return {
                ...item.item
            };
        });

        return await searchOutput.sendArrayOutput({ context, outputPortName, outputType, records: responseData });
    },

    getOutputPortOptions(context, outputType) {
        if (outputType === 'object' || outputType === 'first') {
            return context.sendJson([
                { label: 'Deal ID', value: 'id' },
                { label: 'Type', value: 'type' },
                { label: 'Title', value: 'title' },
                { label: 'Value', value: 'value' },
                { label: 'Currency', value: 'currency' },
                { label: 'Status', value: 'status' },
                { label: 'Visible To', value: 'visible_to' },
                { label: 'Owner', value: 'owner', schema: { type: 'object', properties: { id: { type: 'number', title: 'Owner ID' } } } },
                {
                    label: 'Stage',
                    value: 'stage',
                    schema: {
                        type: 'object',
                        properties: {
                            id: { type: 'number', title: 'Stage ID' },
                            name: { type: 'string', title: 'Stage Name' }
                        }
                    }
                },
                {
                    label: 'Person',
                    value: 'person',
                    schema: {
                        type: 'object',
                        properties: {
                            id: { type: 'number', title: 'Person ID' },
                            name: { type: 'string', title: 'Person Name' }
                        }
                    }
                },
                { label: 'Organization', value: 'organization' },
                { label: 'Custom Fields', value: 'custom_fields', schema: { type: 'array', items: [] } },
                { label: 'Notes', value: 'notes', schema: { type: 'array', items: [] } }
            ], outputPortName);
        } else if (outputType === 'array') {
            return context.sendJson([
                {
                    label: 'Deals',
                    value: 'records',
                    schema: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { label: 'Deal ID', value: 'id' },
                                type: { label: 'Type', value: 'type' },
                                title: { label: 'Title', value: 'title' },
                                value: { label: 'Value', value: 'value' },
                                currency: { label: 'Currency', value: 'currency' },
                                status: { label: 'Status', value: 'status' },
                                visible_to: { label: 'Visible To', value: 'visible_to' },
                                owner: { label: 'Owner', value: 'owner', schema: { type: 'object', properties: { id: { type: 'number', title: 'Owner ID' } } } },
                                stage: {
                                    label: 'Stage',
                                    value: 'stage',
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'number', title: 'Stage ID' },
                                            name: { type: 'string', title: 'Stage Name' }
                                        }
                                    }
                                },
                                person: {
                                    label: 'Person',
                                    value: 'person',
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'number', title: 'Person ID' },
                                            name: { type: 'string', title: 'Person Name' }
                                        }
                                    }
                                },
                                organization: { label: 'Organization', value: 'organization' },
                                custom_fields: { label: 'Custom Fields', value: 'custom_fields', schema: { type: 'array', items: [] } },
                                notes: { label: 'Notes', value: 'notes', schema: { type: 'array', items: [] } }
                            }
                        }
                    }
                }
            ], outputPortName);
        } else if (outputType === 'file') {
            return context.sendJson([
                { label: 'File ID', value: 'fileId', schema: { type: 'string', format: 'appmixer-file-id' } }
            ], outputPortName);
        } else {
            // Default to array output
            return context.sendJson([], outputPortName);
        }
    }
};
