'use strict';

const { makeRequest } = require('../../commons');
module.exports = {

    async receive(context) {

        const { tenantId, projectUUID, lastDays = 1, properties = "origin, contactId, assignees, assistantId, segment, sentiment, status, humanHandOff, resolvedAt, resolvedBy" } = context.messages.in.content;

        let body = {};
        if(!tenantId) throw 'tenantId not found';
        if(!projectUUID) throw 'projectUUID not found';
        
        const { data } = await makeRequest(context, `/atombot/api/v1/conversations/find`, { 
            data: { tenantId, projectUUID, lastDays: parseInt(lastDays), properties },
            method: "POST" 
        });

        return context.sendJson(data, 'out');
    }
};
