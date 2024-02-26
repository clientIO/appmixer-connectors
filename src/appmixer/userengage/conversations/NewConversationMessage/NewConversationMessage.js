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
                message['source_context'] = JSON.stringify(message['source_context']);
                return context.sendJson(message, 'message');
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
                message['source_context'] = JSON.stringify(message['source_context']);
                return context.sendJson(message, 'message');
            });
            await context.saveState(state);
        }
    }
};

