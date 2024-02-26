'use strict';

const { listItems } = require('../commons');

module.exports = {

    async receive(context) {

        try {
            const users = await listItems(context, 'users?');
            return context.sendJson({ users }, 'out');
        } catch (err) {
            if (context.properties.variableFetch) {
                return context.sendJson({ users: [] }, 'out');
            }
            context.log({ stage: 'Error', err });
            throw new Error(err);
        }
    },

    sitesToSelectArray({ users }) {

        return users.map((user) => {
            return { label: user.displayName, value: user.id };
        });
    }
};
