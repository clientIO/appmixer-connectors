'use strict';
const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        let agents;
        try {
            const { data } = await apiCall(context, { url: '/agents' });
            agents = data;
        } catch (e) {
            const code = e.response?.data?.code || e.response?.body?.code;
            if (code === 'access_denied') {
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
