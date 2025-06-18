'use strict';

module.exports = {
    async receive(context) {

        const { org, env } = context.properties;

        // https://cloud.google.com/apigee/docs/reference/apis/apigee/rest/v1/organizations.environments.keyvaluemaps/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://apigee.googleapis.com/v1/organizations/${org}/environments/${env}/keyvaluemaps`,
            headers: {
                Authorization: `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
