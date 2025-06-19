const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {
        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Models', value: 'result' });
        }

        // https://developers.line.biz/en/reference/messaging-api/#get-rich-menu-list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.line.me/v2/bot/richmenu/list',
            headers: {
                'Authorization': `Bearer ${context.auth.channelAccessToken}`
            }
        });

        if (!Array.isArray(data.richmenus) || !data.richmenus.length) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: data.richmenus, outputType, arrayPropertyValue: 'models' });
    }
};

const schema = {
    richMenuId: { type: 'string', title: 'Rich Menu ID' },
    name: { type: 'string', title: 'Name' },
    size: {
        type: 'object',
        title: 'Size',
        properties: {
            width: { type: 'number', title: 'Size.Width' },
            height: { type: 'number', title: 'Size.Height' }
        }
    },
    chatBarText: { type: 'string', title: 'Chat Bar Text' },
    selected: { type: 'boolean', title: 'Selected' },
    areas: {
        type: 'array',
        title: 'Areas',
        items: {
            type: 'object',
            properties: {
                bounds: {
                    type: 'object',
                    title: 'Areas.Bounds',
                    properties: {
                        x: { type: 'number', title: 'Areas.Bounds.X' },
                        y: { type: 'number', title: 'Areas.Bounds.Y' },
                        width: { type: 'number', title: 'Areas.Bounds.Width' },
                        height: { type: 'number', title: 'Areas.Bounds.Height' }
                    }
                },
                action: {
                    type: 'object',
                    title: 'Areas.Action',
                    properties: {
                        type: { type: 'string', title: 'Areas.Action.Type' },
                        data: { type: 'string', title: 'Areas.Action.Data' }
                    }
                }
            }
        }
    }
};
