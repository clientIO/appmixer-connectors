'use strict';

const request = require('request-promise');

module.exports = {

    receive(context) {

        return request({
            method: 'GET',
            url: `https://app.verify-email.org/api/v1/${context.auth.key}/credits`,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            json: true
        }).then((body) => {
            return context.sendJson(body, 'credits');
        });
    }
};
