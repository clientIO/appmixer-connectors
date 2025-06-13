'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const {
            org,
            env,
            mapname,
            entryName,
            'value|ip': valueIp,
            'value|ttl': valueTTL
        } = context.messages.in.content;

        // https://cloud.google.com/apigee/docs/reference/apis/apigee/rest/v1/organizations.environments.keyvaluemaps.entries/create
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'v1/organizations/{org}/environments/{env}/keyvaluemaps/{mapname}/entries',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
