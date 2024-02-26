'use strict';

const request = require('request-promise');

module.exports = {

    receive(context) {

        let email = context.messages.email.content;
        return request({
            method: 'GET',
            url: `https://app.verify-email.org/api/v1/${context.auth.key}/verify/${email.email}`,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            json: true,
            resolveWithFullResponse: true
        }).then((res) => {
            res.body.credits = res.headers['x-credits'];
            if (res.body.status === 1) {
                return context.sendJson(res.body, 'ok');
            } else {
                return context.sendJson(res.body, 'bad');
            }
        });
    }
};
