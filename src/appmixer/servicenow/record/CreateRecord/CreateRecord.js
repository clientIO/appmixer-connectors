/* eslint-disable camelcase */
'use strict';

const { getBasicAuth } = require('../../commons');

module.exports = {

    async receive(context) {

        const {
            tableName,
            record,
            sysparm_display_value,
            sysparm_exclude_reference_link,
            sysparm_fields,
            sysparm_view,
            sysparm_query_no_domain
        } = context.messages.in.content;

        let recordJson = {};
        try {
            recordJson = JSON.parse(record);
        } catch (error) {
            throw new context.CancelError('Invalid record JSON. Details: ' + error.message);
        }

        const options = {
            method: 'POST',
            url: `https://${context.auth.instance}.service-now.com/api/now/table/${tableName}`,
            headers: {
                'User-Agent': 'Appmixer (info@appmixer.com)',
                'Authorization': ('Basic ' + getBasicAuth(context.auth.username, context.auth.password))
            },
            data: recordJson,
            params: {
                sysparm_display_value,
                sysparm_exclude_reference_link,
                sysparm_fields,
                sysparm_view,
                sysparm_query_no_domain
            }
        };

        context.log({ step: 'Making request', options });
        const { data } = await context.httpRequest(options);

        return context.sendJson(data?.result, 'out');
    }
};
