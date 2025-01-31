'use strict';

const lib = require('../lib');


module.exports = {
    
    async receive(context) {
        
        if (context.properties.generateInspector) {
            return context.sendJson({
                inputs: {
                    url: {
                        label: 'Chat URL',
                        type: 'text',
                        readonly: true,
                        defaultValue: context.getWebhookUrl()
                    }
                }
            }, 'out');
        }

        if (context.messages.webhook) {

            const req = context.messages.webhook.content;

            // https://docs.dhtmlx.com/chatbot/guides/styling/
            const options = {
                format: context.properties.format || 'markdown', // markdown, text
                render: context.properties.render || 'blocks'  // blocks, bubbles, flow, cards
            };

            await context.log({ step: 'webhook', req });

            if (req.method === 'GET') {

                if (req.query.init) {

                    const res = {
                        chats: [{
                            id: 1,
                            data: [],
                            agent: 1,
                            theme: 'Ask me anything',
                            created: new Date()
                        }],
                        agents: [{
                            id: 1,
                            name: 'Agent',
                            avatar: 'https://img.freepik.com/premium-vector/avatar-icon002_750950-52.jpg'
                        }],
                        messages: []
                    };
                    return context.response(res, 200, { 'Content-Type': 'application/json' });
                } else {
                    // Main page.
                    const page = lib.generateWebUI(context.getWebhookUrl(), options);
                    return context.response(page, 200, { 'Content-Type': 'text/html' });
                }
            } else if (req.method === 'POST') {

                // { chatId, messageId, content }
                await context.sendJson(req.data, 'out');
            }
        }
    }
};
