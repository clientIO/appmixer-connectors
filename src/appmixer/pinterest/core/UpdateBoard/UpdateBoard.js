'use strict';

module.exports = {
    async receive(context) {

        const { boardId, name, description, privacy } = context.messages.in.content;

        // https://developers.pinterest.com/docs/api/v5/boards/#update-board
        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: `https://api.pinterest.com/v5/boards/${boardId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            data: {
                name: name,
                description: description,
                privacy: privacy
            }
        });

        return context.sendJson(data, 'out');
    }
};
