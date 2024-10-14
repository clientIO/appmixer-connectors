const { createHash } = require('crypto');

module.exports = {

    async receive(context) {

        const { accountId, audienceId } = context.messages.in.content;
        const accessToken = context.auth.accessToken;

        const fields = [
            'EMAIL',
            'PHONE',
            'GEN',
            'DOBY',
            'DOBM',
            'DOBD',
            'FN',
            'LN',
            'FI',
            'CT',
            'ST',
            'ZIP',
            'COUNTRY',
            'MADID',
            'EXTERN_ID'
        ];

        const member = [];
        const schema = [];
        fields.forEach(field => {
            const value = context.messages.in.content[field];
            if (value) {
                const normalizedValue = createHash('sha256').update(value).digest('hex');
                member.push(normalizedValue);
                schema.push(field);
            }
        });

        const body = {
            payload: {
                schema: schema,
                data: [member]
            },
            access_token: accessToken
        };

        const url = `https://graph.facebook.com/v20.0/${audienceId}/users`;
        const response = await context.httpRequest.post(url, body);

        if (!response || !response.data || response.data.num_received !== 1) {
            throw new Error(`Failed to add member to audience. Response: ${JSON.stringify({
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                data: response.data,
                requestBody: body
            })}`);
        }
        return context.sendJson({
            account_id: accountId,
            audience_id: audienceId,
            num_received: response.data.num_received,
            num_invalid_entries: response.data.num_invalid_entries,
            session_id: response.data.session_id
        }, 'out');
    }
};
