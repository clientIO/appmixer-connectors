'use strict';
const commons = require('../../userengage-commons');
const Promise = require('bluebird');

/**
 * Process conversations to find newly added.
 * @param {Set} knownConversations
 * @param {Array} currentConversations
 * @param {Array} newConversations
 * @param {Object} conversation
 */
function processConversations(knownConversations, currentConversations, newConversations, conversation) {

    let arr = [];

    if (knownConversations) {
        knownConversations.forEach(known => {
            arr.push(Object.keys(known)[0]);
            if (Object.keys(known)[0] === conversation['id'] + ''
                && known[conversation['id']] !== conversation['messages']) {

                newConversations.push(conversation);
            }
        });
        if (arr.indexOf(conversation['id'] + '') === -1 && conversation['messages']) {
            newConversations.push(conversation);
        }
    } else if (!knownConversations && conversation['messages']) {
        newConversations.push(conversation);
    }

    let obj = {};
    obj[conversation['id']] = conversation['messages'];
    currentConversations.push(obj);
}

/**
 * Process messages to find newly added.
 * @param {Set} knownMessages
 * @param {Array} currentMessages
 * @param {Array} newMessages
 * @param {Object} message
 */
function processMessages(knownMessages, currentMessages, newMessages, message) {

    if (knownMessages && !knownMessages.has(message['id'])) {
        newMessages.push(message);
    }
    currentMessages.push(message['id']);
}

/**
 * Map a raw message into the exact shape emitted on the 'message' port.
 * Shared by tick() and test() so the output shape stays identical.
 * @param {Object} message
 * @return {Object}
 */
function mapMessage(message) {

    message['source_context'] = JSON.stringify(message['source_context']);
    return message;
}

/**
 * Component which triggers whenever new conversation message comes.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let state = context.state || {};
        let { apiKey } = context.auth;
        let { conversation } = context.properties;

        if (!conversation) {
            let conversations = await commons.getUserengageRequest(apiKey, 'channels', 'GET');
            let promises = [];
            let known = Array.isArray(state.known) ? new Set(state.known) : null;
            let current = [];
            let diff = [];

            if (conversations.results.length) {
                conversations.results.forEach(processConversations.bind(null, known, current, diff));
            }
            state['known'] = current;

            diff.forEach(conversation => {
                promises.push(commons.getUserengageRequest(apiKey, 'channels/' + conversation.id, 'GET'));
            });

            let response = await Promise.all(promises);

            let knownMsg = Array.isArray(state.knownMessages) ? new Set(state.knownMessages) : null;
            current = [];
            diff = [];

            response.forEach(conversation => {
                conversation.results.messages.forEach(processMessages.bind(null, knownMsg, current, diff));
            });
            state['knownMessages'] = current;

            await Promise.map(diff, message => {
                return context.sendJson(mapMessage(message), 'message');
            });
            await context.saveState(state);
        } else {
            let conversation = await commons.getUserengageRequest(apiKey, 'channels/' + conversation, 'GET');
            let knownMsg = Array.isArray(state.knownMessages) ? new Set(state.knownMessages) : null;
            let current = [];
            let diff = [];

            if (conversation.results.messages.length) {
                conversation.results.messages.forEach(processMessages.bind(null, knownMsg, current, diff));
            }
            state['knownMessages'] = current;

            await Promise.map(diff, message => {
                return context.sendJson(mapMessage(message), 'message');
            });
            await context.saveState(state);
        }
    },

    async test(context) {

        let { apiKey } = context.auth;
        let { conversation } = context.properties;

        // Mirror tick()'s branch selection so the output matches whichever path
        // production would take for this config. No state.
        let channelId = conversation;
        if (!channelId) {
            // No conversation filter: pick the freshest conversation, like tick()'s scan.
            let latestConversation = await commons.getLatestResult(apiKey, 'channels');
            if (!latestConversation) {
                throw new Error('No recent conversations to use as test data.');
            }
            channelId = latestConversation.id;
        }

        let channel = await commons.getUserengageRequest(apiKey, 'channels/' + channelId, 'GET');
        let messages = (channel && channel.results && Array.isArray(channel.results.messages))
            ? channel.results.messages
            : [];
        if (!messages.length) {
            throw new Error('No recent conversation messages to use as test data.');
        }
        // Same per-message mapping tick() applies before emitting.
        return context.sendJson(mapMessage(messages[0]), 'message');
    }
};

