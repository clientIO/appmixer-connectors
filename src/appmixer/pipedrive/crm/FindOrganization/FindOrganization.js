'use strict';
const commons = require('../../pipedrive-commons');
const searchOutput = require('../../searchOutput');

const outputPortName = 'out';

/**
 * FindOrganization action.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { generateOutputPortOptions } = context.properties;
        let data = context.messages.in.content;
        const organizationsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Organizations');

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, data.outputType);
        }

        const response = await organizationsApi.findAsync(data);

        if (response.success === false) {
            throw new context.CancelError(response.formattedError);
        }

        if (response.data.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return await searchOutput.sendArrayOutput(
            {
                context,
                outputPortName,
                outputType: data.outputType,
                records: response.data
            });

    },

    getOutputPortOptions(context, outputType) {
        switch (outputType) {
            case 'first':
            case 'object':
                return context.sendJson([
                    { label: 'Current Page Index', value: 'index', schema: { type: 'integer' } },
                    { label: 'Pages Count', value: 'count', schema: { type: 'integer' } },
                    { label: 'Organization ID', value: 'id' },
                    { label: 'Name', value: 'name' },
                    { label: 'Visible To', value: 'visible_to' },
                    { label: 'Details', value: 'details', schema: { type: 'object', properties: {} } }
                ], outputPortName);

            case 'array':
                return context.sendJson([
                    { label: 'Pages Count', value: 'count', schema: { type: 'integer' } },
                    {
                        label: 'Organizations',
                        value: 'records',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { label: 'Organization ID', value: 'id' },
                                    name: { label: 'Name', value: 'name' },
                                    visible_to: { label: 'Visible To', value: 'visible_to' },
                                    details: { label: 'Details', value: 'details', schema: { type: 'object', properties: {} } }
                                }
                            }
                        }
                    }
                ], outputPortName);

            case 'file':
                return context.sendJson([
                    { label: 'File ID', value: 'fileId', schema: { type: 'string', format: 'appmixer-file-id' } },
                    { label: 'Pages Count', value: 'count', schema: { type: 'integer' } }
                ], outputPortName);

            default:
                return context.cancelError('Unsupported outputType ' + outputType);
        }
    }
};
