'use strict';
const axios = require('axios');
const secrets = require('../../secrets');

module.exports = {

    async receive(context) {

        const token = context.config.apiToken || secrets.token;
        const params = context.messages.in.content;
        let endpoint = 'https://shot.screenshotapi.net/screenshot';
        params['token'] = token;
        params['output'] = 'json';

        const response = await axios.get(endpoint, {
            params
        });

        return context.sendJson(response.data, 'out');
    }
};
