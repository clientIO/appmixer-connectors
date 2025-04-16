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
    },

    parseIPs(input) {

        let ips = [];

        if (typeof input === 'string') {
            // Check if the string is a JSON array
            try {
                const parsed = JSON.parse(input);
                if (Array.isArray(parsed)) {
                    ips = parsed;
                } else {
                    ips = input.split(/\s+|,/)
                        .filter(item => item)
                        .map(ip => ip.trim());
                }
            } catch (e) {
                ips = input.split(/\s+|,/)
                    .filter(item => item)
                    .map(ip => ip.trim());
            }
        } else if (Array.isArray(input)) {
            ips = input;
        }

        return ips;
    }
};
