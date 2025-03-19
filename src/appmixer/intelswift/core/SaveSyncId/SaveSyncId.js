'use strict';

const { makeRequest } = require('../../commons');
module.exports = {

    async receive(context) {

        const { platformType, contactId, tenantId, botId, origin, syncId } = context.messages.in.content;

        let body = {};
        if(!platformType) throw 'platformType not found';

        if(platformType == 'zoho') body.zohoId = syncId;
        if(platformType == 'hubspot') body.hubspotId = syncId;
        if(platformType == 'pipedrive') body.pipedriveId = syncId;

        const { data } = await makeRequest(context, `/atombot/api/v1/contacts/update/?tenantId=${tenantId}&contactId=${contactId}`, { 
            data: { 
                contactId, 
                botId, 
                origin, 
                ...body 
            },
            method: "PATCH" 
        });

        return context.sendJson(data, 'out');
    }
};
