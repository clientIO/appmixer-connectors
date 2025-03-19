'use strict';

const { makeRequest } = require('../../commons');
module.exports = {

    async receive(context) {

        const { platformType, syncId, ticketId, tenantId } = context.messages.in.content;

        let body = {};
        if(!platformType) throw 'platformType not found';

        if(platformType == 'jira') body.jiraId = syncId;
        if(platformType == 'zendesk') body.zendeskId = syncId;

        const { data } = await makeRequest(context, `/atombot/api/v1/tickets/update/${ticketId}?tenantId=${tenantId}`, { 
            data: { 
                field: body 
            },
            method: "PATCH" 
        });

        return context.sendJson(data, 'out');
    }
};
