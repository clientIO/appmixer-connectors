'use strict';

module.exports = {
    async receive(context) {

        const { mapName } = context.messages.in.content;
        const { org, env } = context.properties;

        // https://cloud.google.com/apigee/docs/reference/apis/apigee/rest/v1/organizations.environments.keyvaluemaps.entries/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://apigee.googleapis.com/v1/organizations/${org}/environments/${env}/keyvaluemaps/${mapName}/entries`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
