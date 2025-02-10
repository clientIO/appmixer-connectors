'use strict';

module.exports = {

    async receive(context) {
        const { base_uri: basePath, account_id: accountId } = context.profileInfo.accounts[0];

        const req = {
            method: 'POST',
            url: `${basePath}/restapi/v2.1/accounts/${accountId}/envelopes`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: JSON.parse(context.messages.in.content.jsonInput)
        };

        const res = await context.httpRequest(req);

        return context.sendJson(res.data, 'out');
    }
};

