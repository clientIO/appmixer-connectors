'use strict';

const { makeRequest } = require('../../common');

module.exports = {

    async receive(context) {

        const {
            userId,
            campaignId
        } = context.messages.in.content;
        const requestData = {
            'id': campaignId,
            'target_by': 'user_id',
            'target': [userId]
        };
        await makeRequest({ context, options: { path: '/execute/campaign' , data: requestData } });
        return context.sendJson(context.messages.in.content , 'out');
    }
};

