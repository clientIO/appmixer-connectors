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
        if (outputType === 'object' || outputType === 'first') {
            return context.sendJson([
                { label: 'Organization ID', value: 'id' },
                { label: 'Name', value: 'name' },
                { label: 'Visible To', value: 'visible_to' },
                { label: 'Details', value: 'details', schema: { type: 'object', properties: {} } }
            ], outputPortName);
        } else if (outputType === 'array') {
            return context.sendJson([
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
