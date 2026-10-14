'use strict';

const lib = require('../lib');
const { makeRequest } = require('../commons');

/**
 * A recipient is a user ID or a UPN/email. The multiselect gives an array, a mapped
 * value can be a comma-separated string.
 * @param {string|array} value
 * @return {string[]}
 */
const toRecipients = (value) => {

    const list = Array.isArray(value) ? value : String(value || '').split(',');
    return list.map((item) => String(item).trim()).filter(Boolean);
};

const toMember = (idOrUpn) => ({
    '@odata.type': '#microsoft.graph.aadUserConversationMember',
    roles: ['owner'],
    // OData escapes a single quote by doubling it.
    'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${idOrUpn.replace(/'/g, '\'\'')}')`
});

/**
 * Create the chat to post into. Graph returns the existing chat for a oneOnOne, so repeated
 * runs reuse it. A group chat is created anew on every call.
 * @param {object} context
 * @param {string[]} recipients
 * @param {string} [topic]
 * @return {Promise<string>} chat ID
 */
const createChat = async (context, recipients, topic) => {

    // The caller must be listed among the members.
    const me = await lib.getMe(context);
    const chatType = recipients.length > 1 ? 'group' : 'oneOnOne';
    const data = { chatType, members: [me.id, ...recipients].map(toMember) };

    if (chatType === 'group' && topic) {
        data.topic = topic;
    }

    const { data: chat } = await makeRequest(context, { method: 'POST', path: '/chats', data });

    return chat.id;
};

module.exports = {

    async receive(context) {

        const { chatId, recipients, topic, content, contentType = 'text', importance } =
            context.messages.in.content;

        if (!content) {
            throw new context.CancelError('Content is required!');
        }

        const targets = toRecipients(recipients);
        if (!chatId && !targets.length) {
            throw new context.CancelError('Chat or Recipients is required!');
        }

        const id = chatId || await createChat(context, targets, topic);

        const message = { body: { contentType, content } };
        if (importance) {
            message.importance = importance;
        }

        const { data } = await makeRequest(context, {
            method: 'POST',
            path: `/chats/${encodeURIComponent(id)}/messages`,
            data: message
        });

        return context.sendJson(data, 'out');
    }
};
