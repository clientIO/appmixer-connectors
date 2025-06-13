
'use strict';

const lib = require('../../lib.generated');
const schema = { 
    'name': { 'type': 'string', 'title': 'Name' },
    'encrypted': { 'type': 'boolean', 'title': 'Encrypted' }
};

module.exports = {
    async receive(context) {

        const { org, env, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Key Value Maps', value: 'keyValueMaps' });
        }

        // https://cloud.google.com/apigee/docs/reference/apis/apigee/rest/v1/organizations.environments.keyvaluemaps/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://apigee.googleapis.com/v1/organizations/${org}/environments/${env}/keyvaluemaps`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        // The API returns an array of keyvaluemap names, we need to transform them
        const records = data.keyValueMaps ? data.keyValueMaps.map(kvmName => {
            return {
                name: kvmName,
                encrypted: false // Default value, as the list API doesn't return this info
            };
        }) : [];

        return lib.sendArrayOutput({ 
            context, 
            records, 
            outputType,
            outputPortName: 'out'
        });
    }
};
