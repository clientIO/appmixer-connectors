
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { refund_id, metadata } = context.messages.in.content;

        // https://stripe.com/docs/api/refunds/update
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.stripe.com/v1/refunds/{refund_id}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
