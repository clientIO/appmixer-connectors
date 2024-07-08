'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const { promisify } = require('util');

// GoogleApi initialization & promisify of some api function for convenience
const gmail = GoogleApi.gmail('v1');

module.exports = {
    async receive(context) {

        const listThread = promisify(gmail.users.threads.list.bind(gmail.users.threads));
        const { threads } = await listThread({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId
        });
        return context.sendJson(threads, 'out');
    },

    threadsToSelectArray(threads) {
        return Array.isArray(threads) ? threads.reduce((result, thread) => {
            const snippet = thread.snippet ? thread.snippet.substring(0, 50) : 'NO Subject';
            result.push({
                label: snippet,
                value: thread.id
            });
            return result;
        }, []) : [];
    }
};
