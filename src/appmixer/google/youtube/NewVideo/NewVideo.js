'use strict';
const FormData = require('form-data');

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
    }
};
