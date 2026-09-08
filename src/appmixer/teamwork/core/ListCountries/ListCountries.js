'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {
        const resp = await lib.callAPI(
            context,
            'GET',
            '/countries.json',
            null,
            null
        );

        if (!resp || resp.STATUS !== 'OK') {
            throw new Error(resp?.MESSAGE || 'Failed to fetch countries');
        }

        const countries = Array.isArray(resp.countries) ? resp.countries : [];
        return context.sendJson({ countries }, 'countries');
    },

    toInspector: function(data) {
        const transformed = [];
        if (Array.isArray(data?.countries)) {
            data.countries.forEach(country => {
                transformed.push({
                    label: country.name,
                    value: country.code
                });
            });
        }
        return transformed;
    }

};
