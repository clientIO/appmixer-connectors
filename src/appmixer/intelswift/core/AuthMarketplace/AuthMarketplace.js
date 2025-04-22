'use strict';

const { makeRequest } = require('../../commons');
module.exports = {

    async receive(context) {

        const { apiKey } = context.messages.in.content;

        if(!apiKey) throw 'apiKey not found';
        
        const { data } = await makeRequest(context, `/api/v1/marketplace/auth`, { 
            data: { apiKey },
            method: "POST" 
        });

        return context.sendJson(data?.data, 'out');
    }
};
