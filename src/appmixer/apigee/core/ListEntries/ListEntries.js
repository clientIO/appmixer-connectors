
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { org, env, mapName } = context.messages.in.content;

        // https://cloud.google.com/apigee/docs/reference/apis/apigee/rest/v1/organizations.environments.keyvaluemaps.entries/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://apigee.googleapis.com/v1/organizations/{org}/environments/{env}/keyvaluemaps/{mapName}/entries',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
