'use strict';

const lib = require('../../lib');

const fetchUsers = async (context) => {
    const response = await lib.callEndpoint(context, '/users', {
        method: 'GET'
    });

    return response.data.results
        .filter(user => user.type === 'person')  // Filter out bot users
        .map(user => ({
            id: user.id,
            // The email is only present when the integration may read user emails.
            email: user.person?.email || user.name || user.id
        }));
};

module.exports = {
    // Private: only ever called as the source of a people dropdown. Cached, and a
    // failure renders an empty dropdown rather than an error.
    async receive(context) {
        try {
            const users = await lib.withCache(context, ['ListUsers'], () => fetchUsers(context));
            return context.sendJson({ users }, 'out');
        } catch (err) {
            return context.sendJson({ users: [] }, 'out');
        }
    },

    usersToSelectArray({ users }) {
        return users.map(user => ({
            value: user.id,
            label: user.email
        }));
    }
};
