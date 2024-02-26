'use strict';
const request = require('request-promise');

/**
 * Component which will create a message and send it to recepients
 */
module.exports = {

    async receive(context) {

        const apiUrl = context.profileInfo.apiUrl;
        const groups = await request({
            method: 'GET',
            url: apiUrl + 'groups',
            headers: {
                'api-key': context.auth.apiKey
            },
            json: true
        });

        context.sendJson(groups, 'groups');
    },

    contactsToSelectArray(groups) {

        if (groups && Array.isArray(groups.data)) {
            return groups.data.map(c => ({ label: c.name, value: c.id }));
        }
        return [];
    }
};
