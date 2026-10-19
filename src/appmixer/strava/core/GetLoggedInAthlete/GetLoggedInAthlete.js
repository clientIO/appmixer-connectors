'use strict';

const { API_BASE_URL } = require('../../constants');

module.exports = {

    async receive(context) {

        // Get authenticated athlete using Strava API
        // https://developers.strava.com/docs/reference/#api-Athletes-getLoggedInAthlete
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${API_BASE_URL}/athlete`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
