'use strict';
const FormData = require('form-data');
const { google } = require('googleapis');
const commons = require('../../google-commons');
const { promisify } = require('util');

module.exports = {

    async start(context) {

        const { channelId } = context.properties;
        const data = new FormData();
        data.append('hub.topic', `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`);
        data.append('hub.callback', `${context.appmixerApiUrl}/plugins/appmixer/google/youtube/trigger/${context.flowId}/component/${context.componentId}`);
        data.append('hub.mode', 'subscribe');
        data.append('hub.lease_seconds', '604800');

        const options = {
            url: 'https://pubsubhubbub.appspot.com/subscribe',
            method: 'POST',
            data,
            headers: {
                ...data.getHeaders()
            }
        };
        await context.httpRequest(options);
    },

    async stop(context) {

        const { channelId } = context.properties;
        const data = new FormData();
        data.append('hub.topic', `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`);
        data.append('hub.callback', `${context.appmixerApiUrl}/plugins/appmixer/google/youtube/trigger/${context.flowId}/component/${context.componentId}`);
        data.append('hub.mode', 'unsubscribe');
        data.append('hub.lease_seconds', '604800');

        const options = {
            url: 'https://pubsubhubbub.appspot.com/subscribe',
            method: 'POST',
            data,
            headers: {
                ...data.getHeaders()
            }
        };
        await context.httpRequest(options);
    },

    async receive(context) {

        await context.sendJson(context.messages.webhook?.content?.data, 'out');
        return context.response({ status: 'success' }, 200, { 'Content-Type': 'application/atom+xml' });
    },

    // Flow Test Mode: emit the channel's latest video without subscribing to PubSubHubbub.
    // Read-only — the production webhook payload is built (in routes.js) from the channel's Atom
    // feed; here we fetch the newest video for the same channelId via the YouTube Data API
    // (search.list order=date) and reshape it into the IDENTICAL output object routes.js emits.
    async test(context) {

        const { channelId } = context.properties;
        if (!channelId) {
            throw new context.CancelError('Channel ID is required!');
        }

        const youtube = google.youtube({
            version: 'v3',
            auth: commons.getAuthLibraryOAuth2Client(context.auth)
        });
        const listSearchResults = promisify(youtube.search.list).bind(youtube.search);

        const { data } = await listSearchResults({
            part: 'id,snippet',
            channelId,
            type: 'video',
            order: 'date',
            maxResults: 1
        });

        const item = (data.items || [])[0];
        if (!item) {
            throw new Error('No videos found on the channel to use as test data.');
        }

        const videoId = item.id.videoId;
        const { title, description, publishedAt, channelTitle } = item.snippet;

        // Reshape into the same object the PubSubHubbub route forwards (routes.js). The Atom feed
        // exposes a separate `updated` timestamp; the Data API only returns the publish time, so
        // it is reused here (for a freshly uploaded video the two are equal).
        const output = {
            videoId,
            title,
            description,
            publishDate: publishedAt,
            updatedDate: publishedAt,
            channelId,
            channelTitle,
            channelUrl: `https://www.youtube.com/channel/${channelId}`,
            videoUrl: `https://www.youtube.com/watch?v=${videoId}`
        };

        return context.sendJson(output, 'out');
    }
};
