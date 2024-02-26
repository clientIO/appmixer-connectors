'use strict';
const request = require('request-promise');
const baseUrl = 'https://api.merk.cz:443';

module.exports = {

    get(endpoint, apiKey, qs) {

        return request({
            url: baseUrl + endpoint,
            qs: qs,
            json: true,
            headers: {
                'Authorization': 'Token ' + apiKey
            }
        });
    }
};
