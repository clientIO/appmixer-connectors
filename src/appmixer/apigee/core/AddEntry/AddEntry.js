'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {

        const { ips, ttl, comment = '' } = context.messages.in.content;

        const ipsList = lib.parseIPs(ips);

        const expiration = ttl ? new Date(Date.now() + ttl * 1000).valueOf() : null;

        const BLOCKED_IPS = 'blocked-ips';

        const list = await getOrCreateList(context, BLOCKED_IPS);

        ipsList.forEach(ip => {
            list['test'] = {
                ip,
                // comment,
                expiration
            };
        });

        await setList(context, BLOCKED_IPS, JSON.stringify({ ip: "1.1.1.1", expiration }));
        return context.sendJson({}, 'out');
    }
};

const setList = (context, name, value) => {

    const { mapName } = context.messages.in.content;
    const { org, env } = context.properties;
    // https://cloud.google.com/apigee/docs/reference/apis/apigee/rest/v1/organizations.environments.keyvaluemaps.entries/create
    return context.httpRequest({
        method: 'PUT',
        url: `https://apigee.googleapis.com/v1/organizations/${org}/environments/${env}/keyvaluemaps/${mapName}/entries/${name}`,
        headers: {
            'Authorization': `Bearer ${context.auth.accessToken}`
        },
        data: { name, value }
    });
};

const getOrCreateList = async (context, name) => {

    const { mapName } = context.messages.in.content;
    const { org, env } = context.properties;
    // https://cloud.google.com/apigee/docs/reference/apis/apigee/rest/v1/organizations.environments.keyvaluemaps.entries/create
    try {
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://apigee.googleapis.com/v1/organizations/${org}/environments/${env}/keyvaluemaps/${mapName}/entries/${name}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return JSON.parse(data.value || '{}');
    } catch (error) {

        if (error.response && error.response.status === 404) {
            // TODO check the kvm exists
            await createEntry(context, name, '{}');
            return {};
        }
        throw new context.CancelError(`Cannot use the entry ${name}.`);
    }
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
