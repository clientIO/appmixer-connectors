'use strict';

module.exports = {
    async receive(context) {

        const { boardId } = context.messages.in.content;

        // https://developers.pinterest.com/docs/api/v5/boards/#delete-board

        await context.httpRequest({
            method: 'DELETE',
            url: `https://api.pinterest.com/v5/boards/${boardId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson({ success: true }, 'out');
    }
};
