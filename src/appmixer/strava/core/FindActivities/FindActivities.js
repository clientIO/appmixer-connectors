
'use strict';

const lib = require('../../lib.generated');
const { API_BASE_URL } = require('../../constants');

const schema = {
    'id': { 'type': 'number', 'title': 'Activity ID' },
    'name': { 'type': 'string', 'title': 'Name' },
    'type': { 'type': 'string', 'title': 'Type' },
    'sport_type': { 'type': 'string', 'title': 'Sport Type' },
    'distance': { 'type': 'number', 'title': 'Distance' },
    'moving_time': { 'type': 'number', 'title': 'Moving Time' },
    'elapsed_time': { 'type': 'number', 'title': 'Elapsed Time' },
    'start_date': { 'type': 'string', 'title': 'Start Date' },
    'start_date_local': { 'type': 'string', 'title': 'Start Date Local' }
};

module.exports = {
    async receive(context) {

        const { after, before, outputType } = context.messages.in.content;

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Activities' });
        }

        // Build query parameters
        const params = {
            per_page: 200  // Max allowed by Strava API
        };

        if (after) {
            params.after = after;
        }
        if (before) {
            params.before = before;
        }

        // Get activities using Strava API
        // https://developers.strava.com/docs/reference/#api-Activities-getLoggedInAthleteActivities
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${API_BASE_URL}/athlete/activities`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            params: params
        });

        const records = data || [];

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
