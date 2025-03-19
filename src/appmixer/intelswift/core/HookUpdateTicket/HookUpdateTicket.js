'use strict';

const { makeRequest } = require('../../commons');
module.exports = {

    async receive(context) {

        const { platformType, syncId, ...meta } = context.messages.in.content;

        // remaining to handles tenantId and projectId

        let body = {};
        if(!platformType) throw 'platformType not found';
        if(!syncId) throw 'syncId not found';

        if(platformType == 'jira') body.jiraId = syncId;
        if(platformType == 'zendesk') body.zendeskId = syncId;
        
        const { data } = await makeRequest(context, `/api/v1/marketplace/update/ticket`, { 
            data: { 
                meta,
                ...body 
            },
            method: "POST" 
        });

        return context.sendJson(data, 'out');
    }
};
