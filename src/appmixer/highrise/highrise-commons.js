'use strict';
const HighriseAPI = require('node-highrise-api');
const check = require('check-types');
const moment = require('moment');

module.exports = {

    /**
     * Get new HighriseAPI
     * @param {string} companyName
     * @param {string} token
     * @param {Object} options
     * @param {string} options.userAgent
     * @returns {*}
     */
    getHighriseAPI(companyName, token, options) {

        const userAgent = options.userAgent
            || process.env.GRIDD_USER_AGENT
            || 'AppMixer Dev info@appmixer.com (https://appmixer.com)';

        return new HighriseAPI({
            'username': companyName,
            'token': token,
            'secure': true,
            'headers': {
                'User-Agent': userAgent
            }
        });
    },

    /**
     * Recursively get all people form Highrise system.
     * @param {function} getHighrisePeopleFunc - function has to return Promise
     * @param {Array} result - initialize with []
     * @param {Object} [qs] - query string, 'n' and 'since' are two supported params
     * @param {number} [offset]
     * @return {Promise.<*>}
     */
    getPeople(getHighrisePeopleFunc, result, qs, offset = 0) {

        try {
            qs = qs || {};
            check.assert.object(qs, 'Invalid query string object, has to be null or object.');
            check.assert.array(result);
        } catch (err) {
            return Promise.reject(err);
        }

        return getHighrisePeopleFunc(Object.assign(qs, { n: offset }))
            .then(response => {
                if (response.length === 0) {
                    return result;
                }

                result = result.concat(response);
                if (response.length < 500) {
                    return result;
                }
                return this.getPeople(getHighrisePeopleFunc, result, qs, offset + 500);
            });
    },

    /**
     * GET /people.xml route has an optional since param that can be used to return
     * created or updated people since that date. This function returns timestamp
     * in that format.
     */
    generateSince() {

        return moment.utc().format('YYYYMMDDHHmmss');
    }
};
