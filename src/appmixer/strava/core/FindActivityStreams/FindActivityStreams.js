
'use strict';

const lib = require('../../lib.generated');
const { API_BASE_URL } = require('../../constants');

const schema = {
    'type': { 'type': 'string', 'title': 'Stream Type' },
    'data': { 'type': 'array', 'title': 'Stream Data', 'items': { 'type': 'number' } },
    'series_type': { 'type': 'string', 'title': 'Series Type' },
    'original_size': { 'type': 'number', 'title': 'Original Size' },
    'resolution': { 'type': 'string', 'title': 'Resolution' }
};

module.exports = {

    async receive(context) {

        const { activityId, keys, outputType } = context.messages.in.content;

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Activity Streams' });
        }

        // Validate required fields
        if (!activityId) {
            throw new context.CancelError('Activity ID is required!');
        }
        if (!keys || !Array.isArray(keys) || keys.length === 0) {
            throw new context.CancelError('At least one stream key must be selected!');
        }

        // Build the keys parameter (comma-separated string from array)
        const keysParam = keys.join(',');

        // Get activity streams using Strava API
        // https://developers.strava.com/docs/reference/#api-Streams-getActivityStreams
        let data;
        try {
            ({ data } = await context.httpRequest({
                method: 'GET',
                url: `${API_BASE_URL}/activities/${activityId}/streams`,
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`
                },
                params: {
                    keys: keysParam
                }
            }));
        } catch (error) {
            // Strava answers 404 both for an unknown activity and for one that
            // simply carries no stream data (every manually created activity).
            if (error.response && error.response.status === 404) {
                return context.sendJson({}, 'notFound');
            }
            throw error;
        }

        const records = Array.isArray(data) ? data : [];

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
