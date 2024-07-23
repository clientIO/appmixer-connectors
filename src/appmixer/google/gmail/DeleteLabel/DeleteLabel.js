'use strict';
const commons = require('../gmail-commons');

module.exports = {
    async receive(context) {
        const { labelId } = context.messages.in.content;
        
        const endpoint = `/users/me/labels/${labelId}`;
        const options = {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        await commons.callEndpoint(context, endpoint, options);
        return context.sendJson({ id: labelId }, 'deleted');
    }
};
