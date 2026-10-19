'use strict';

const { API_BASE_URL } = require('../../constants');

module.exports = {
    async receive(context) {

        const {
            name,
            sportType,
            startDateLocal,
            elapsedTime,
            description,
            distance,
            trainer,
            commute
        } = context.messages.in.content;

        // Validate required fields based on Strava API documentation
        if (!name) {
            throw new context.CancelError('Name is required!');
        }
        if (!sportType) {
            throw new context.CancelError('Sport Type is required!');
        }
        if (!startDateLocal) {
            throw new context.CancelError('Start Date Local is required!');
        }
        if (!elapsedTime) {
            throw new context.CancelError('Elapsed Time is required!');
        }

        // Prepare form data
        const formData = {
            name,
            sport_type: sportType,
            start_date_local: startDateLocal,
            elapsed_time: elapsedTime
        };

        // Add optional fields if provided
        if (description) {
            formData.description = description;
        }
        if (distance) {
            formData.distance = distance;
        }
        if (trainer) {
            formData.trainer = trainer;
        }
        if (commute) {
            formData.commute = commute;
        }

        // Create manual activity using Strava API
        // https://developers.strava.com/docs/reference/#api-Activities-createActivity
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `${API_BASE_URL}/activities`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: formData
        });

        return context.sendJson(data, 'out');
    }
};
