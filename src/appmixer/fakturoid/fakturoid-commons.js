'use strict';
const request = require('request-promise');
const baseUrl = 'https://app.fakturoid.cz/api/v2/accounts/';

module.exports = {

    request(endpoint, method, credentials, qs, json, done) {

        return request({
            method: method,
            url: baseUrl + credentials.slug + endpoint,
            auth: {
                user: credentials.email,
                pass: credentials.apiKey
            },
            qs: qs,
            json: json,
            headers: {
                'User-Agent': 'Appmixer (info@appmixer.com)'
            }
        });
    },

    post(endpoint, credentials, json) {

        return this.request(endpoint, 'POST', credentials, undefined, json);
    },

    get(endpoint, credentials, qs) {

        return this.request(endpoint, 'GET', credentials, qs, true);
    }
};
