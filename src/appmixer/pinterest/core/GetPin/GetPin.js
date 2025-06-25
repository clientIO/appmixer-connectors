'use strict';

module.exports = {
    async receive(context) {

        const { pinId } = context.messages.in.content;

        // https://developers.pinterest.com/docs/api/v5/pins-get
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://api.pinterest.com/v5/pins/${pinId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
