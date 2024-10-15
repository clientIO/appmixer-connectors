/* eslint-disable camelcase */
'use strict';

const { callEndpoint, convertToTitleCase } = require('../../lib');

async function getJSONStructure(context, { tableName }) {

    try {

        const { data } = await callEndpoint(context, {

            action: `table/${tableName}`,
            params: {
                sysparm_exclude_reference_link: true,
                sysparm_limit: 1
            }
        });

        return data?.result[0] || {};
    } catch (e) {
        context.log({ stage: 'get schema error', error: e?.response });
        throw new context.CancelError(`Unable to retrieve the schema for the table "${tableName}". There must be at least one record in the table.`);
    }
}

function toOutputScheme(context, json) {
    const scheme = Object.keys(json).map((key) => {
        return {
            label: convertToTitleCase(key),
            value: key,
            scheme: { type: 'string' }
        };
    });

    return context.sendJson(scheme, 'out');
}

function toInspector(context, json) {
    const inputs = {};

    Object.keys(json).forEach((key, index) => {
        inputs[key] = {
            label: convertToTitleCase(key),
            type: 'text',
            tooltip: key,
            index
        };
    });
    return context.sendJson({ inputs }, 'out');
}

module.exports = {

    async receive(context) {

        const { tableName, generateInspector, generateOutputPortOptions } = context.properties;

        if (generateOutputPortOptions) {
            return toOutputScheme(context, await getJSONStructure(context, { tableName }));
        }

        if (generateInspector) {
            return toInspector(context, await getJSONStructure(context, { tableName }));
        }

        const inputs = context.messages.in.content;

        context.log({ stage: 'inputs ', inputs: inputs });

        const { data } = await callEndpoint(context, {
            method: 'POST',
            action: `table/${tableName}`,
            data: inputs
        });

        return context.sendJson(data?.result, 'out');
    }
};
