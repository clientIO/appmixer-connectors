
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { message, imageThumbnail, imageFullsize, stickerPackageId, stickerId } = context.messages.in.content;

        // https://notify-bot.line.me/doc/en/
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://notify-api.line.me/api/notify',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
