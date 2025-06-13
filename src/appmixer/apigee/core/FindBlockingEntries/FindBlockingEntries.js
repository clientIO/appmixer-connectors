
'use strict';

const lib = require('../../lib.generated');
const schema = { 'entryName':{ 'type':'string','title':'Entry Name' },'value':{ 'type':'object','properties':{ 'ip':{ 'type':'string','title':'Value.Ip' },'ttl':{ 'type':'number','title':'Value.Ttl' } },'title':'Value' } };

module.exports = {
    async receive(context) {

        const { org, env, mapname, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'entries', value: 'entries' });
        }

        // https://cloud.google.com/apigee/docs/reference/apis/apigee/rest/v1/organizations.environments.keyvaluemaps.entries/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'v1/organizations/{org}/environments/{env}/keyvaluemaps/{mapname}/entries',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return lib.sendArrayOutput({ context, records, outputType, arrayPropertyValue: 'entries' });
    }
};
