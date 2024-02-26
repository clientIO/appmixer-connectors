'use strict';
const request = require('request-promise');
const url = require('url');

module.exports = {

    /**
     * Get request for userengage.
     * @param {string} token
     * @param {string} endpoint
     * @param {string} method
     * @param {object} [data]
     * @param {string} [key]
     * @returns {*}
     */
    getUserengageRequest(token, endpoint, method, data, key) {

        //key parameter is needed because some of POST requests send data as 'body' and some as 'form'
        let options = {
            method: method,
            url: 'https://app.userengage.io/api/public/' + endpoint + '/',
            headers: {
                authorization: 'Token ' + token
            },
            json: true
        };

        if (key) {
            options[key] = data;
        }

        return request(options)
            .catch(err => {
                if (err.code === 502) {
                    // when userengage servers goes down for maintenance they return this huge HTML
                    // message, let's ditch that and display something useful to users.
                    err.message = 'Userengage server is down due to maintenance.';
                }
                throw err;
            });
    },

    /**
     * Recursively get all users from userengage.
     * @param {string} token
     * @param {Object} [qs] - query string
     * @param {Array} [users] - result array for recursion
     * @param {number} [page] default is 1 (first page)
     * @return {Promise<Array>}
     */
    getUsers(token, qs, users, page = 1) {

        users = users || [];
        qs = qs || {};
        qs.page = page;

        if (!Array.isArray(users)) {
            return Promise.reject(new Error('Users param must be an array.'));
        }

        return this.getUserengageRequest(token, 'users', 'GET', qs, qs ? 'qs' : undefined)
            .then(response => {
                users = users.concat(response.results);
                if (response.next) {
                    let parsedUrl = url.parse(response.next, true);
                    if (!parsedUrl.query.page) {
                        return Promise.reject('Invalid URL from userengage, missing page param');
                    }
                    return this.getUsers(token, qs, users, parsedUrl.query.page);
                }
                return users;
            });
    },

    /**
     * Convert date string ('2017-03-16T13:03:35.000177Z') to Unix timestamp (in seconds)
     * which can be used as a query parameter to userengage API calls.
     * @param {string} [dateString] - whatever that can be passed into new Date() constructor.
     *    If not given, current time will be used.
     * @return {number}
     */
    getTimestamp(dateString) {

        return Math.floor((dateString ? new Date(dateString) : new Date()) / 1000);
    }
};
