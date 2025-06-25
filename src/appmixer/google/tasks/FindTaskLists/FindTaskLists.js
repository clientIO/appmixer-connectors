
'use strict';

const lib = require('../lib.generated');
const schema = { 'id':{ 'type':'string','title':'Id' },'title':{ 'type':'string','title':'Title' } };

module.exports = {
    async receive(context) {

        const { query, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Task Lists', value: 'items' });
        }

        // https://developers.google.com/tasks/reference/rest/v1/tasklists/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: '/tasks/v1/users/@me/lists',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
