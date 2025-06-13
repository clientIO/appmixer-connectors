'use strict';

module.exports = {
    async receive(context) {

        const { pinId } = context.messages.in.content;

        // https://developers.pinterest.com/docs/api/v5/boards/#delete-board
        /* eslint-disable no-unused-vars */
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: `https://api.pinterest.com/v5/pins/${pinId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson({ success: true }, 'out');
    }
};
