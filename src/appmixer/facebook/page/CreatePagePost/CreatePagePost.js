'use strict';
const graph = require('fbgraph');
const Promise = require('bluebird');

/**
 * Component for Create a post
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        graph.setVersion('3.2');
        let client = graph.setAccessToken(context.auth.accessToken);
        let newPost = context.messages.content.content;
        let { pageId } = newPost;
        delete newPost['pageId'];

        let get = Promise.promisify(client.get, { context: client });
        let post = Promise.promisify(client.post, { context: client });

        let pageDetails = await get(`/${pageId}`, { fields: 'access_token, name' });

        if (newPost['scheduled_publish_time']) {
            let now = parseInt((new Date().getTime() / 1000).toFixed(0));
            let timestamp = parseInt((new Date(newPost['scheduled_publish_time']).getTime() / 1000).toFixed(0));

            // scheduled time can must be at least 10 minutes from now according to FB
            // add 30 seconds - enough time to reach FB with this request
            if (timestamp < (now + 630)) {
                timestamp = now + 630;
            }

            newPost['scheduled_publish_time'] = timestamp;
            // if scheduled time is given, attr 'published' has to be set to false
            newPost['published'] = false;
        }

        client.setAccessToken(pageDetails['access_token']);
        let result = await post(`/${pageId}/feed`, newPost);
        return context.sendJson(
            Object.assign(
                newPost,
                {
                    id: result.id,
                    pageId: pageId,
                    pageName: pageDetails['name']
                }),
            'newPost');
    }
};
