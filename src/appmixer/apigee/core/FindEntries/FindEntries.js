
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { organization, environment, mapName } = context.messages.in.content;

        // https://cloud.google.com/apigee/docs/reference/apis/apigee/rest/v1/organizations.environments.keyvaluemaps.entries/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://cloud.google.com/apigee/docs/reference/apis/apigee/rest/v1/organizations.environments.keyvaluemaps.entries/list',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
