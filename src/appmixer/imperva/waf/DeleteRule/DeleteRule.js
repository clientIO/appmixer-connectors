'use strict';

const { baseUrl } = require('../../lib');

module.exports = {

    receive: async function(context) {

        const { siteId, ruleId } = context.messages.in.content;

        await context.httpRequest({
            headers: {
                'x-API-Id': context.auth.id,
                'x-API-Key': context.auth.key
            },
            url: `${baseUrl}/v2/sites/${siteId}/rules/${ruleId}`,
            method: 'DELETE'
        });

        return context.sendJson({ site_id: siteId, rule_id: ruleId }, 'out');
    }
};
