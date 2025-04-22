'use strict';

const { makeRequest } = require('../../commons');
module.exports = {

    async receive(context) {

        const { tenantId, projectUUID, lastDays = 1, properties = 'contactId, lastInquery, tags, meta' } = context.messages.in.content;

        let body = {};
        if(!tenantId) throw 'tenantId not found';
        if(!projectUUID) throw 'projectUUID not found';
        
        const { data } = await makeRequest(context, `/atombot/api/v1/contacts/find`, { 
            data: { tenantId, projectUUID, lastDays: parseInt(lastDays), properties },
            method: "POST" 
        });

        return context.sendJson(data, 'out');
    }
};
