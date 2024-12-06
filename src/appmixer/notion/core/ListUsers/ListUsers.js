'use strict';

const lib = require('../../lib');

module.exports = {
    async receive(context) {
        const response = await lib.callEndpoint(context, '/users', {
            method: 'GET'
        });

        const users = response.data.results
            .filter(user => user.type === 'person')  // Filter out bot users
            .map(user => ({
                id: user.id,
                email: user.person.email
            }));

        return context.sendJson({ users }, 'out');
    },

    usersToSelectArray({ users }) {
        return users.map(user => ({
            value: user.id,
            label: user.email
        }));
    }
};
