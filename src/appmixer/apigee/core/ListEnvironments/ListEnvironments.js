'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {

        const { org, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType,
                { 'name': { 'type': 'string', 'title': 'Environment Name' } },
                { label: 'Environments', value: 'environments' }
            );
        }

        // https://cloud.google.com/apigee/docs/reference/apis/apigee/rest/v1/organizations.environments/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://apigee.googleapis.com/v1/organizations/${org}/environments`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        // Transform the array of environment names into objects
        const records = (data.environments || []).map(envName => ({
            name: envName
        }));

        return lib.sendArrayOutput({
            context,
            records,
            outputType,
            outputPortName: 'out'
        });
    }
};
