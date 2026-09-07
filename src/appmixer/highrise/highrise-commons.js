'use strict';
const HighriseAPI = require('node-highrise-api');
const check = require('check-types');
const moment = require('moment');
const Promise = require('bluebird');

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
    },

    /**
     * Build a Highrise API client from the trigger context. Shared by both the
     * production tick() path and the Flow Test Mode test() path so the request
     * (auth + transport) lives in one place.
     * @param {Object} context
     * @return {*} HighriseAPI client
     */
    getClient(context) {

        const { companyId } = context.properties;
        const options = { userAgent: context.auth.userAgent };
        return this.getHighriseAPI(companyId, context.auth.accessToken, options);
    },

    /**
     * Promisified fetch of a Highrise collection. `clientMethod` is the SDK list
     * method (e.g. client.people.get) and `methodContext` its owner object so the
     * SDK builds the request and maps the response exactly as it does for tick().
     * @param {function} clientMethod
     * @param {Object} methodContext
     * @param {...*} args - args forwarded to the SDK method (e.g. `true` for open cases)
     * @return {Promise.<Array>}
     */
    fetchCollection(clientMethod, methodContext, ...args) {

        const promisified = Promise.promisify(clientMethod, { context: methodContext });
        return promisified(...args);
    },

    /**
     * Pick the newest record from a Highrise collection. Highrise records carry a
     * numeric `id` that increases with creation order, so the highest id is the
     * most recently created item. Used by test() to emit one representative record.
     * @param {Array} records
     * @return {Object|null}
     */
    pickLatest(records) {

        if (!Array.isArray(records) || records.length === 0) {
            return null;
        }
        return records.reduce((latest, record) => {
            return (record && record.id > latest.id) ? record : latest;
        }, records[0]);
    }
};
