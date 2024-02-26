'use strict';
const { XMLParser } = require('fast-xml-parser');
const parser = new XMLParser();

module.exports = context => {

    context.http.router.register({
        method: 'POST',
        path: '/trigger/{flowId}/component/{componentId}',
        options: {
            payload: {
                multipart: true,
                parse: false,
                allow: ['application/xml', 'application/atom+xml']
            },
            handler: async (req, h) => {

                const payload = parser.parse(req.payload.toString('utf8'));
                const {
                    entry: {
                        'yt:videoId': videoId,
                        title,
                        description,
                        published: publishDate,
                        updated: updatedDate,
                        'yt:channelId': channelId,
                        author: { name: channelTitle, uri: channelUrl }
                    }
                } = payload.feed;

                const output = {
                    videoId,
                    title,
                    description,
                    publishDate,
                    updatedDate,
                    channelId,
                    channelTitle,
                    channelUrl,
                    videoUrl: `https://www.youtube.com/watch?v=${videoId}`
                };

                const result = await context.triggerComponent(
                    req.params.flowId,
                    req.params.componentId,
                    output,
                    {},
                    {}
                );

                let response = h.response(result.body);
                if (result.headers) {
                    response.headers = Object.assign(response.headers, result.headers);
                }
                return response.code(result.statusCode || 200);
            },
            auth: false
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/trigger/{flowId}/component/{componentId}',
        options: {
            auth: false,
            handler: async (req, h) => {

                if (req.query['hub.challenge']) {
                    return h.response(req.query['hub.challenge']).code(200).type('text/plain');
                }
                return {};
            }
        }
    });
};
