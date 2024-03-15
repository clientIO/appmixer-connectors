'use strict';
const request = require('request-promise');
const baseUrl = 'http://api.openweathermap.org/data/2.5';

module.exports = {

    get(endpoint, qs = {}, apiKey = '3de55cc0324f35c9fece832cad46c5e2') {

        qs.appid = apiKey;

        return request({
            method: 'GET',
            url: baseUrl + endpoint,
            qs: qs,
            json: true
        });
    }
};
