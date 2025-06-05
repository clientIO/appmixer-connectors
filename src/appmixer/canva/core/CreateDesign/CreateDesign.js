'use strict';

module.exports = {
    async receive(context) {
        const { type, name, width, height, title } = context.messages.in.content;

        // https://www.canva.dev/docs/connect//create-design
        const body = {};
        if (type) body.type = type;
        if (name) body.name = name;
        if (width) body.width = width;
        if (height) body.height = height;
        if (title) body.title = title;

        const data = await context.httpRequest({
            method: 'POST',
            url: 'https://api.canva.com/rest/v1/designs',
            headers: {
            'Authorization': `Bearer ${context.auth.accessToken}`
            },
            body
        });

        return context.sendJson(data.data.design, 'out');
    }
};
