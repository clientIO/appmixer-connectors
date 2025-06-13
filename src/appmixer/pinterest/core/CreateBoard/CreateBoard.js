'use strict';

module.exports = {
    async receive(context) {

        const { name, description, privacy } = context.messages.in.content;

        // https://developers.pinterest.com/docs/api/v5/boards-create
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.pinterest.com/v5/boards',
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
