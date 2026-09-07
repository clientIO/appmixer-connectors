
'use strict';

const { API_BASE_URL } = require('../../constants');

module.exports = {

    async receive(context) {

        const { athleteId } = context.messages.in.content;

        // Validate required input
        if (!athleteId) {
            throw new context.CancelError('Athlete ID is required.');
        }

        // https://developers.strava.com/docs/reference/#api-Athletes-getStats
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${API_BASE_URL}/athletes/${athleteId}/stats`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
