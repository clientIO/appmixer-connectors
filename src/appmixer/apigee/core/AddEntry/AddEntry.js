'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { mapName, entryName, ips, ttl } = context.messages.in.content;

        const { org, env } = context.properties;

        const ipsList = lib.parseIPs(ips);

        // https://cloud.google.com/apigee/docs/reference/apis/apigee/rest/v1/organizations.environments.keyvaluemaps.entries/create
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `v1/organizations/${org}/environments/${env}/keyvaluemaps/${mapName}/entries`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
