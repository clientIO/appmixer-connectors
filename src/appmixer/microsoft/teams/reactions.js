'use strict';

const lib = require('./lib');
const { makeRequest } = require('./commons');

/**
 * setReaction and unsetReaction address the same message and differ only in the action
 * segment, so AddReaction and RemoveReaction share this call. Each component validates its
 * own inputs before getting here.
 * @param {object} context
 * @param {string} action - 'setReaction' or 'unsetReaction'
 * @return {Promise<*>}
 */
module.exports = async function react(context, action) {

    const {
        location = 'channel', teamId, channelId, chatId, messageId, parentMessageId, reactionType
    } = context.messages.in.content;

    const path = lib.messagePath({ location, teamId, channelId, chatId, messageId, parentMessageId });

    await makeRequest(context, { method: 'POST', path: `${path}/${action}`, data: { reactionType } });

    return context.sendJson({}, 'out');
};
