'use strict';

module.exports = {
    async receive(context) {

        const teamsResponse = await context.httpRequest.get('https://api.clickup.com/api/v2/team', {
            headers: {
                Authorization: `Bearer ${context.auth.accessToken}`
            }
        });

        if (!teamsResponse.data.teams || !teamsResponse.data.teams.length) {
            return context.CancelError('No teams authorized.');
        }

        const teamId = teamsResponse.data.teams[0].id;

        const spacesResponse = await context.httpRequest.get(`https://api.clickup.com/api/v2/team/${teamId}/space`, {
            headers: {
                Authorization: `Bearer ${context.auth.accessToken}`
            }
        });
        return context.sendJson({ spaces: spacesResponse.data.spaces }, 'out');
    },

    toSelectArray(out) {
        return (out.spaces || []).map(space => {
            return {
                label: space.name,
                value: space.id
            };
        });
    }
};
