'use strict';

const { makeRequest } = require('../commons');

module.exports = {

    async receive(context) {

        const {
            teamId, channelId, content, contentType = 'text', subject, importance, replyToMessageId
        } = context.messages.in.content;

        if (!teamId) {
            throw new context.CancelError('Team is required!');
        }
        if (!channelId) {
            throw new context.CancelError('Channel is required!');
        }
        if (!content) {
            throw new context.CancelError('Content is required!');
        }

        const messages = `/teams/${encodeURIComponent(teamId)}/channels/${encodeURIComponent(channelId)}/messages`;
        // A reply is posted under its root message. Graph ignores a subject there.
        const path = replyToMessageId
            ? `${messages}/${encodeURIComponent(replyToMessageId)}/replies`
            : messages;

        const message = { body: { contentType, content } };
        if (importance) {
            message.importance = importance;
        }
        if (subject && !replyToMessageId) {
            message.subject = subject;
        }

        const { data } = await makeRequest(context, { method: 'POST', path, data: message });

        return context.sendJson(data, 'out');
    }
};
