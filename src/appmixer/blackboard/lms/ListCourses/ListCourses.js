'use strict';
const Blackboard = require('../../sdk');

module.exports = {

    async receive(context) {

        const client = new Blackboard(
            context.auth.clientId,
            context.auth.clientSecret,
            context.config.serverUrl,
            context.auth.redirectUrl,
            context.httpRequest
        );

        client.setAccessToken(context.auth.accessToken);
        const data = await client.callApi('get', '/v3/courses');
        return context.sendJson({ courses: data.results }, 'out');
    },

    toSelectArray({ courses }) {

        return courses.map(c => ({ label: c.name, value: c.id }));
    }
};
