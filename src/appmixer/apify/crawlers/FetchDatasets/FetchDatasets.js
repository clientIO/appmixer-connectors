const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { desc } = context.messages.in.content;

        // https://docs.apify.com/api/v2#/reference/datasets/dataset-collection/get-list-of-datasets
        const { data } = await lib.callEndpoint(context, {
            method: 'GET',
            action: 'datasets'
        });

        return context.sendJson(data, 'out');
    }
};
