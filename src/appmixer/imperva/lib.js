'use strict';

module.exports = {

    baseUrl: 'https://my.imperva.com/api/prov',

    /**
     * @param {object} auth Auth object
     * @param {string} auth.id API ID
     * @param {string} auth.key API Key
     */
    getAuthHeader: function(auth) {

        return {
            'x-API-Id': auth.id,
            'x-API-Key': auth.key
        };
    }
};
