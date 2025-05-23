
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { channelId, name, type, position, topic, nsfw, rate_limit_per_user, bitrate, user_limit, permission_overwrites, parent_id, rtc_region, video_quality_mode, default_auto_archive_duration, flags } = context.messages.in.content;

        // https://discord.com/developers/docs/resources/channel#modify-channel
        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: 'https://discord.com/api/v10/channels/${channelId}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
