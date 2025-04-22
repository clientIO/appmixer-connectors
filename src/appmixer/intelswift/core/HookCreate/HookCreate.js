'use strict';

const { makeRequest } = require('../../commons');
module.exports = {

    async receive(context) {

        const { platformType, syncId, name, firstName, lastName, tenantId, projectUUID } = context.messages.in.content;

        // remaining to handles tenantId and projectId

        let body = {};
        if(!platformType) throw 'platformType not found';

        if(platformType == 'zoho') body.zohoId = syncId;
        if(platformType == 'hubspot') body.hubspotId = syncId;
        if(platformType == 'pipedrive') body.pipedriveId = syncId;

        const { data } = await makeRequest(context, `/api/v1/marketplace/create/contact`, { 
            data: { 
                name, 
                firstName, 
                lastName, 
                tenantId,
                projectUUID,
                ...body 
            },
            method: "POST" 
        });

        return context.sendJson(data, 'out');
    }
};
