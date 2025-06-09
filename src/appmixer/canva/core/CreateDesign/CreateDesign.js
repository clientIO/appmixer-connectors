'use strict';

module.exports = {
    async receive(context) {
        const { type, name, width, height, title } = context.messages.in.content;

        // https://www.canva.dev/docs/connect//create-design
        const body = {};

        if (type) {
            body.design_type = { type };

            if (type === 'preset' && name) {
                body.design_type.name = name;
            }

            if (type === 'custom') {
                if (width) body.design_type.width = width;
                if (height) body.design_type.height = height;
            }
        }

        if (title) {
            body.title = title;
        }

        const data = await context.httpRequest({
            method: 'POST',
            url: 'https://api.canva.com/rest/v1/designs',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: body
        });

        return context.sendJson(data.data.design, 'out');
    }
};
