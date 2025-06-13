'use strict';

module.exports = {
    async receive(context) {

        const { org } = context.messages.in.content;

        // https://cloud.google.com/apigee/docs/reference/apis/apigee/rest/v1/organizations.environments/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://apigee.googleapis.com/v1/organizations/${org}/environments`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
