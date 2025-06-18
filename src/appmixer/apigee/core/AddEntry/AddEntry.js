'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {

        const { ips, ttl, comment } = context.messages.in.content;

        const ipsList = lib.parseIPs(ips);

        const expiration = ttl ? new Date(Date.now() + ttl * 1000).toISOString() : null;
        for (let ip of ipsList) {

            const value = JSON.stringify({
                ip: ip,
                comment,
                expiration
            });
            try {
                await updateEntry(context, ip, value);
            } catch (e) {
                if (e.response.status === 404) {
                    await createEntry(context, ip, value);
                } else {
                    throw e;
                }
            }
        }

        return context.sendJson({}, 'out');
    }
};

const updateEntry = (context, name, value) => {

    const { mapName } = context.messages.in.content;
    const { org, env } = context.properties;
    // https://cloud.google.com/apigee/docs/reference/apis/apigee/rest/v1/organizations.environments.keyvaluemaps.entries/create
    return context.httpRequest({
        // method: 'POST',
        method: 'PUT',
        url: `https://apigee.googleapis.com/v1/organizations/${org}/environments/${env}/keyvaluemaps/${mapName}/entries/${name}`,
        headers: {
            'Authorization': `Bearer ${context.auth.accessToken}`
        },
        data: { name, value }
    });
};

const createEntry = (context, name, value) => {

    const { mapName } = context.messages.in.content;
    const { org, env } = context.properties;

    // https://cloud.google.com/apigee/docs/reference/apis/apigee/rest/v1/organizations.environments.keyvaluemaps.entries/create
    return context.httpRequest({
        method: 'POST',
        url: `https://apigee.googleapis.com/v1/organizations/${org}/environments/${env}/keyvaluemaps/${mapName}/entries`,
        headers: {
            'Authorization': `Bearer ${context.auth.accessToken}`
        },
        data: { name, value }
    });

};