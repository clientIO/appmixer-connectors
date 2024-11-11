/* eslint-disable camelcase */
'use strict';

const { getBasicAuth } = require('../../lib');

module.exports = {

    async receive(context) {

        const {
            tableName,
            sys_id,
            sysparm_display_value,
            sysparm_exclude_reference_link,
            sysparm_fields,
            sysparm_view,
            sysparm_query_no_domain
        } = context.messages.in.content;

        const options = {
            method: 'GET',
            url: `https://${context.auth.instance}.service-now.com/api/now/table/${tableName}/${sys_id}`,
            headers: {
                'User-Agent': 'Appmixer (info@appmixer.com)',
                'Authorization': ('Basic ' + getBasicAuth(context.auth.username, context.auth.password))
            },
            params: {
                sysparm_display_value,
                sysparm_exclude_reference_link,
                sysparm_fields,
                sysparm_view,
                sysparm_query_no_domain
            }
        };

        context.log({ step: 'Requesting data', options });
        const { data } = await context.httpRequest(options);

        return context.sendJson(data?.result, 'out');
    }
};
