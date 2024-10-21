'use strict';

const { WebClient } = require('@slack/web-api');
const Promise = require('bluebird');

/**
 * Process users to find newly created or joined.
 * @param {Set} knownUsers
 * @param {Set} actualUsers
 * @param {Set} newUsers
 * @param {Object} user
 */
function processUsers(knownUsers, actualUsers, newUsers, user) {

    if (knownUsers && !knownUsers.has(user['id'])) {
        newUsers.add(user);
    }
    actualUsers.add(user['id']);
}

/**
 * Component which triggers whenever new user created or joined your team.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const web = new WebClient(context.auth.accessToken);
        const state = await context.loadState();
        const { members: users } = await web.users.list({ limit: 999 });

        let known = Array.isArray(state.known) ? new Set(state.known) : null;
        let actual = new Set();
        let diff = new Set();

        users.forEach(processUsers.bind(null, known, actual, diff));

        if (diff.size) {
            await Promise.map(diff, user => {
                return context.sendJson(user, 'user');
            });
        }
        await context.saveState({ known: Array.from(actual) });
    }
};

