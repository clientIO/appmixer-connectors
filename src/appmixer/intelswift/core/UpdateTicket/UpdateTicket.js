'use strict';

const { makeRequest } = require('../../commons');
module.exports = {

    async receive(context) {

        const { tenantId, projectUUID, data } = context.messages.in.content;

        if(!tenantId) throw 'tenantId not found';
        if(!projectUUID) throw 'projectUUID not found';
        if(!data) throw 'data not found';
        
        const { data: result } = await makeRequest(context, `/api/v1/marketplace/update/tickets`, { 
            data: { tenantId, projectUUID, data: JSON.parse(data) },
            method: "POST" 
        });

        return context.sendJson(result, 'out');
    }
};
