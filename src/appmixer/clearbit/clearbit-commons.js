'use strict';
const ClearbitAPI = require('clearbit').Client;

module.exports = {

    /**
     * Get new ClearbitAPI
     * @param {Object} apiKey
     * @returns {*}
     */
    getClearbitAPI(apiKey) {

        return new ClearbitAPI(apiKey);
    }
};
