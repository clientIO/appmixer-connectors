'use strict';
const ActiveCampaign = require('../../ActiveCampaign');
const { trimUndefined } = require('../../helpers');

module.exports = {

    async receive(context) {

        const { service, externalid, name, logoUrl, linkUrl } = context.messages.in.content;
        for (const [key, val] of Object.entries({ service, externalid, name, logoUrl, linkUrl })) {
            if (!val) {
                throw new context.CancelError(`${key} is required`);
            }
        }

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        const payload = { connection: trimUndefined({ service, externalid, name, logoUrl, linkUrl }) };
        const { data } = await ac.call('post', 'connections', payload);

        return context.sendJson(data.connection, 'out');
    }
};
