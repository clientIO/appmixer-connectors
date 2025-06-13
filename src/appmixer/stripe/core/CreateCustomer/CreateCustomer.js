module.exports = {
    async receive(context) {
        const { email, name, description } = context.messages.in.content;

        const body = {
            email, name, description
        };

        // https://stripe.com/docs/api/customers/create
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/customers',
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: body
        });

        return context.sendJson(data, 'out');
    }
};
