'use strict';

module.exports = {
    async receive(context) {

        const { boardId } = context.messages.in.content;

        // https://developers.pinterest.com/docs/api/v5/boards/#get-board
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://api.pinterest.com/v5/boards/${boardId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
