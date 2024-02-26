'use strict';
const request = require('request-promise');

module.exports = {

    async receive(context) {

        const { auth } = context;
        let agents;
        try {
            agents = await request({
                method: 'GET',
                url: `https://${auth.domain}.freshdesk.com/api/v2/agents`,
                auth: {
                    user: auth.apiKey,
                    password: 'X'
                },
                json: true
            });
        } catch (e) {
            const body = e.response.body;
            if (body.code === 'access_denied') {
                agents = [];
            } else {
                throw e;
            }
        }

        return context.sendJson({ agents }, 'agents');
    },

    agentsToSelectArray({ agents }) {

        return agents.map(agent => {
            return { label: agent.contact.name, value: agent.id };
        });
    }
};
