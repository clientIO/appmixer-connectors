'use strict';

const { API_BASE_URL } = require('../../constants');

module.exports = {
    async receive(context) {

        const {
            activityId,
            name,
            description,
            sportType,
            commute,
            trainer,
            hideFromHome,
            gearId
        } = context.messages.in.content;

        // Validate required field
        if (!activityId) {
            throw new context.CancelError('Activity ID is required!');
        }

        // Build the update payload
        const updateData = {};
        if (name) updateData.name = name;
        if (description) updateData.description = description;
        if (sportType) updateData.sport_type = sportType;
        if (commute !== undefined) updateData.commute = commute;
        if (trainer !== undefined) updateData.trainer = trainer;
        if (hideFromHome !== undefined) updateData.hide_from_home = hideFromHome;
        if (gearId !== undefined) updateData.gear_id = gearId;

        // Update activity using Strava API
        // https://developers.strava.com/docs/reference/#api-Activities-updateActivityById
        await context.httpRequest({
            method: 'PUT',
            url: `${API_BASE_URL}/activities/${activityId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: updateData
        });

        return context.sendJson({}, 'out');
    }
};
