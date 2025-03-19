'use strict';

const { makeRequest } = require('../../commons');
module.exports = {

    async receive(context) {

        const {  syncId, ...meta } = context.messages.in.content;

        // remaining to handles tenantId and projectId

        let body = {};

        body.pipedriveId = syncId;
        
        const { data } = await makeRequest(context, `/api/v1/marketplace/update/contact`, { 
            data: { 
                meta,
                ...body 
            },
            method: "POST" 
        });

        return context.sendJson(data, 'out');
    }
};
