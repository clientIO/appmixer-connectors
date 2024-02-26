'use strict';
const request = require('request-promise');

module.exports = {

    async receive(context) {

        const { accessToken } = context.auth;
        const response = await request({
            method: 'GET',
            url: 'https://graph.microsoft.com/v1.0/groups',
            body: {},
            auth: { bearer: accessToken },
            headers: { 'Accept': 'application/json' },
            json: true
        });

        const groups = response.value || [];
        const teams = groups.filter(group => {
            return (group.resourceProvisioningOptions || []).includes('Team');
        });

        return context.sendJson(teams, 'out');
    },

    teamsToSelectArray(message) {

        const transformed = [];
        if (!message || !Array.isArray(message)) {
            return transformed;
        }

        message.forEach(teamItem => {

            transformed.push({
                label: teamItem.displayName,
                value: teamItem.id
            });
        });

        return transformed;
    }
};
