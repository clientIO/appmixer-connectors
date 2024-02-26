'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey);
        const { data } = await ac.call('get', 'users');
        return context.sendJson({ data }, 'out');
    },

    usersToSelectArray({ data }) {

        const { users = [] } = data;
        return users.map(user => {
            return { label: `${user.firstName} ${user.lastName} - ${user.email}`, value: user.id };
        });
    }
};
