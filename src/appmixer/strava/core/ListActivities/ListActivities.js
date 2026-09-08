
'use strict';

const lib = require('../../lib.generated');
const { API_BASE_URL } = require('../../constants');

const schema = {
    'id': { 'type': 'number', 'title': 'Activity ID' },
    'name': { 'type': 'string', 'title': 'Activity Name' },
    'type': { 'type': 'string', 'title': 'Activity Type' },
    'sport_type': { 'type': 'string', 'title': 'Sport Type' },
    'distance': { 'type': 'number', 'title': 'Distance' },
    'moving_time': { 'type': 'number', 'title': 'Moving Time' },
    'elapsed_time': { 'type': 'number', 'title': 'Elapsed Time' },
    'start_date': { 'type': 'string', 'title': 'Start Date' },
    'start_date_local': { 'type': 'string', 'title': 'Start Date Local' },
    'kudos_count': { 'type': 'number', 'title': 'Kudos Count' },
    'comment_count': { 'type': 'number', 'title': 'Comment Count' },
    'average_speed': { 'type': 'number', 'title': 'Average Speed' },
    'max_speed': { 'type': 'number', 'title': 'Max Speed' }
};

module.exports = {

    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Activities' });
        }

        // List all recent activities using Strava API with maximum items per page
        // https://developers.strava.com/docs/reference/#api-Activities-getLoggedInAthleteActivities
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${API_BASE_URL}/athlete/activities`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            params: {
                per_page: 200  // Maximum allowed by Strava API
            }
        });

        return lib.sendArrayOutput({ context, records: data, outputType });
    }
};
