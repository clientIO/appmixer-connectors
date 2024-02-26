'use strict';
const request = require('request-promise');
const baseUrl = 'https://www.zopim.com/api/v2/';

module.exports = {

    request(endpoint, method, credentials, qs, body) {

        return request({
            method: method,
            url: baseUrl + endpoint,
            qs: qs,
            json: true,
            body: body,
            headers: {
                'Authorization': `Bearer ${credentials.accessToken}`
            }
        });
    },

    get(endpoint, credentials, qs) {

        return this.request(endpoint, 'GET', credentials, qs);
    },

    post(endpoint, credentials, body) {

        return this.request(endpoint, 'POST', credentials, undefined, body);
    },

    update(endpoint, credentials, body) {

        return this.request(endpoint, 'PUT', credentials, undefined, body);
    },

    delete(endpoint, credentials) {

        return this.request(endpoint, 'DELETE', credentials);
    }
};
