'use strict';
const commons = require('../gmail-commons');

module.exports = {
    async receive(context) {
        const { emailId, permanently } = context.messages.in.content;

        const endpoint = permanently 
            ? `/users/me/messages/${emailId}` 
            : `/users/me/messages/${emailId}/trash`;
        
        const options = {
            method: permanently ? 'DELETE' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const result = await commons.callEndpoint(context, endpoint, options);
        if (result.data == "") {
            return context.sendJson({}, 'deleted');
        }
        else return context.sendJson(result.data, 'out')
    }
};
