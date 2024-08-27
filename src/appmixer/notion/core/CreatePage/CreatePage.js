'use strict';
const lib = require('../../lib');

module.exports = {
    async receive(context) {
        const { parentId, content, coverUrl, title, emoji } = context.messages.in.content;

        // Construct the data payload for the Notion API
        const data = {
            parent: {
                type: 'page_id',
                page_id: parentId
            },
            properties: {
                title: {
                    title: [
                        {
                            type: 'text',
                            text: {
                                content: title
                            }
                        }
                    ]
                }
            },
            children: [
                {
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [
                            {
                                type: 'text',
                                text: {
                                    content: content
                                }
                            }
                        ]
                    }
                }
            ]
        };

        if (coverUrl) {
            data.cover = {
                type: 'external',
                external: { url: coverUrl }
            };
        }

        if (emoji) {
            data.icon = {
                type: 'emoji',
                emoji
            };
        }

        const response = await lib.callEndpoint(context, '/pages', {
            method: 'POST',
            data
        });

        await context.sendJson(response.data, 'out');
    }
};
