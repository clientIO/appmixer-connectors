'use strict';

const { baseUrl } = require('../../lib');

module.exports = {

    receive: async function(context) {

        const { siteId, ruleId, ...rule } = context.messages.in.content;

        const { data } = await context.httpRequest({
            headers: {
                'x-API-Id': context.auth.id,
                'x-API-Key': context.auth.key
            },
            url: `${baseUrl}/v2/sites/${siteId}/rules/${ruleId}`,
            method: 'PUT',
            data: {
                ...rule
            }
        });

        return context.sendJson({ ...data, siteId }, 'out');
    }
};
