/* eslint-disable camelcase */
'use strict';

const { getBasicAuth } = require('../../lib');

module.exports = {

    async receive(context) {

        const {
            tableName,
            sys_id,
            sysparm_query_no_domain
        } = context.messages.in.content;

        const options = {
            method: 'DELETE',
            url: `https://${context.auth.instance}.service-now.com/api/now/table/${tableName}/${sys_id}`,
            headers: {
                'User-Agent': 'Appmixer (info@appmixer.com)',
                'Authorization': ('Basic ' + getBasicAuth(context.auth.username, context.auth.password))
            },
            params: {
                sysparm_query_no_domain
            }
        };

        context.log({ step: 'Making request', options });
        await context.httpRequest(options);

        return context.sendJson({ deleted: true }, 'out');
    }
};
