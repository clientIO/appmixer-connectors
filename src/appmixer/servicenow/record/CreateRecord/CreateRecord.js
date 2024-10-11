/* eslint-disable camelcase */
'use strict';

const { callEndpoint } = require('../../lib');

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
        context.log({ stage: 'xx', error: e?.response?.data });
    }
}

module.exports = {

    async receive(context) {

        const {
            // tableName,
            record,
            sysparm_display_value,
            sysparm_exclude_reference_link,
            sysparm_fields,
            sysparm_view,
            sysparm_query_no_domain
        } = context.messages.in.content;

        const { tableName } = context.properties;

        if (context.properties.generateInspector) {
            const jsonStructure = await getJSONStructure(context, { tableName });
            const inputs = {};

            Object.keys(jsonStructure).forEach((key, index) => {
                inputs[key] = {
                    label: key,
                    type: 'text',
                    tooltip: key,
                    index
                };
            });

            context.log({ stage: 'dynamic inspector', inputs });
            return context.sendJson({ inputs }, 'out');
        }

        let recordJson = {};
        try {
            recordJson = JSON.parse(record);
        } catch (error) {
            throw new context.CancelError('Invalid record JSON. Details: ' + error.message);
        }

        console.log(context.properties.generateInspector);

        return;
        const { data } = await callEndpoint(context, {
            method: 'POST',
            action: `table/${tableName}`,
            data: recordJson,
            params: {
                sysparm_display_value,
                sysparm_exclude_reference_link,
                sysparm_fields,
                sysparm_view,
                sysparm_query_no_domain
            }
        });

        return context.sendJson(data?.result, 'out');
    }
};
