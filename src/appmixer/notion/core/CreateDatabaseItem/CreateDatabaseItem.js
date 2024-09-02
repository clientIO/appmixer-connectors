'use strict';
const lib = require('../../lib');

module.exports = {
    async receive(context) {
        const { parentId, content, coverUrl, title, emoji, rawJson, json } = context.messages.in.content;

        // If rawJson is enabled, directly use the provided JSON
        let data;
        if (rawJson) {
            try {
                data = JSON.parse(json);
            } catch (e) {
                throw new context.CancelError(`The input JSON is invalid: ${json}`);
            }
        } else {
            // Construct the data payload for the Notion API with basic fields
            data = {
                parent: {
                    type: 'database_id',
                    database_id: parentId
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
        }

        const response = await lib.callEndpoint(context, '/pages', {
            method: 'POST',
            data
        });

        await context.sendJson(response.data, 'out');
    }
};
