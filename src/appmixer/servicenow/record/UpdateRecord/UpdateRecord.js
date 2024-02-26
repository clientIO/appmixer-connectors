/* eslint-disable camelcase */
'use strict';

const { getBasicAuth } = require('../../commons');

module.exports = {

    async receive(context) {

        const {
            tableName,
            sys_id,
            record,
            pairs,
            sysparm_display_value,
            sysparm_exclude_reference_link,
            sysparm_fields,
            sysparm_input_display_value,
            sysparm_suppress_auto_sys_field,
            sysparm_view,
            sysparm_query_no_domain
        } = context.messages.in.content;

        // For the Table API, however, PUT and PATCH mean the same thing. PUT and PATCH modify only the fields specified in the request.
        const method = 'PATCH';
        // The whole record is sent as a JSON string. We need to parse it to JSON.
        let recordJson = {};
        if (record) {
            // If the record exists, we use the PUT method with JSON.
            try {
                recordJson = JSON.parse(record);
            } catch (error) {
                throw new context.CancelError('Invalid record JSON. Details: ' + error.message);
            }
        } else {
            // If the record does not exist, we use the PATCH method with key-value pairs.
            if (!pairs) {
                throw new context.CancelError('No record or key-value pairs provided.');
            }

            for (const pair of pairs.AND) {
                recordJson[pair.field] = pair.value;
            }
        }

        const options = {
            method,
            url: `https://${context.auth.instance}.service-now.com/api/now/table/${tableName}/${sys_id}`,
            headers: {
                'User-Agent': 'Appmixer (info@appmixer.com)',
                'Authorization': ('Basic ' + getBasicAuth(context.auth.username, context.auth.password))
            },
            data: recordJson,
            params: {
                sysparm_display_value,
                sysparm_exclude_reference_link,
                sysparm_fields,
                sysparm_input_display_value,
                sysparm_suppress_auto_sys_field,
                sysparm_view,
                sysparm_query_no_domain
            }
        };

        context.log({ step: 'Making request', options });
        const { data } = await context.httpRequest(options);

        return context.sendJson(data?.result, 'out');
    }
};
