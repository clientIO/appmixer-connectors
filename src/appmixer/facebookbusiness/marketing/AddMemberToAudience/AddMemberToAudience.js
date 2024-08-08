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
            'MADID'
        ];

        const member = {};
        const schema = {};
        fields.forEach(field => {
            const value = context.messages.in.content[field];
            if (value) {
                member[field] = value;
                schema[field] = field;
            }
        });

        const payload = {
            schema: schema,
            data: [member],
            access_token: accessToken
        };

        const url = `https://graph.facebook.com/v20.0/${audienceId}?access_token=${accessToken}`;
        const response = await context.httpRequest.post(url, payload);
        return context.sendJson({ accountId, audienceId, ...response.data }, 'out');
    }
};
