'use strict';
const commons = require('../../userengage-commons');
const Promise = require('bluebird');

/**
 * Process users to find newly added.
 * @param {Set} knownUsers
 * @param {Array} currentUsers
 * @param {Array} newUsers
 * @param {Object} user
 */
function processUsers(knownUsers, currentUsers, newUsers, user) {

    if (knownUsers && !knownUsers.has(user['id'])) {
        newUsers.push(user);
    }
    currentUsers.push(user['id']);
}

/**
 * Map a raw user record into the exact shape emitted on the 'user' port.
 * Shared by tick() and test() so the output shape stays identical.
 * @param {Object} user
 * @return {Object}
 */
function mapUser(user) {

    user.attributes = user.attributes.length ? JSON.stringify(user.attributes) : '';
    user.tags = user.tags ? user.tags.join(',') : '';
    user.lists = user.lists ? user.lists.join(',') : '';
    return user;
}

/**
 * Component which triggers whenever new user is added.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { apiKey } = context.auth;

        // would be great to use search qa { search: 'created_at', min: context.state.since }
        // but userengage does not support search according to 'created_at', though they do
        // support 'updated_at' so we have to download each time all the users to make the
        // diff
        let users = await commons.getUsers(apiKey);
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        if (users.length) {
            users.forEach(processUsers.bind(null, known, current, diff));
        }

        await Promise.map(diff, user => {
            return context.sendJson(mapUser(user), 'user');
        });
        await context.saveState({ known: Array.from(current) });
    },

    async test(context) {

        let { apiKey } = context.auth;

        // Same 'users' endpoint tick() polls (first page is enough); take the freshest
        // user and apply the same mapping. No state.
        let user = await commons.getLatestResult(apiKey, 'users');
        if (!user) {
            throw new Error('No recent users to use as test data.');
        }
        return context.sendJson(mapUser(user), 'user');
    }
};

