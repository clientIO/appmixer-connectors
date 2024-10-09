const common = require('../../twitter-commons');

module.exports = {

    async receive(context) {

        const { tweetId } = context.messages.in.content;

        const { data } = await common.request(context, {
            method: 'DELETE',
            action: `tweets/${tweetId}`
        });

        return context.sendJson(data.data, 'out');
    }
};
