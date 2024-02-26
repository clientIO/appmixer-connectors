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

    if (knownConversations && !knownConversations.has(conversation['id'])) {
        newConversations.push(conversation);
    }
    currentConversations.push(conversation['id']);
}

/**
 * Component which triggers whenever new conversation comes.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { apiKey } = context.auth;

        let conversations = await commons.getUserengageRequest(apiKey, 'channels', 'GET');
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        if (conversations.results.length) {
            conversations.results.forEach(processConversations.bind(null, known, current, diff));
        }

        //since new conversation in userengage initialy don't have any messages
        //we don't have to fetch by id for more details
        await Promise.map(diff, conversation => {
            return context.sendJson(conversation, 'conversation');
        });
        await context.saveState({ known: current });
    }
};

