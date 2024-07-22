const common = require('../../twitter-commons');

module.exports = {

    async receive(context) {

        const { text } = context.messages.in.content;

        const tweet = {
            text: text.replace(/(?<!\w)(@)([\w]+)/g, '$2'),
            reply_settings: 'mentionedUsers'
        };

        const { data } = await common.request(context, {
            method: 'POST',
            action: 'tweets',
            data: tweet
        });

        return context.sendJson(data.data, 'out');
    }
};
