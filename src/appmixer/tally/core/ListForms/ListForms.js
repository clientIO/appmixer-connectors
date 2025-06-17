
'use strict';

const lib = require('../../lib.generated');
const schema = { 'id':{ 'type':'string','title':'Form ID' },'name':{ 'type':'string','title':'Form Name' },'workspaceId':{ 'type':'string','title':'Workspace ID' },'status':{ 'type':'string','title':'Status' },'numberOfSubmissions':{ 'type':'number','title':'Number Of Submissions' },'isClosed':{ 'type':'boolean','title':'Is Closed' },'payments':{ 'type':'array','items':{ 'type':'object','properties':{ 'amount':{ 'type':'number','title':'Payments.Amount' },'currency':{ 'type':'string','title':'Payments.Currency' } } },'title':'Payments' },'createdAt':{ 'type':'string','title':'Created At' },'updatedAt':{ 'type':'string','title':'Updated At' } };

module.exports = {
    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Forms', value: 'items' });
        }

        // https://developers.tally.so/api-reference/endpoint/forms/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.tally.so/forms',
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`
            }
        });

        return lib.sendArrayOutput({ context, records: data.items, outputType, arrayPropertyValue: 'items' });
    }
};
