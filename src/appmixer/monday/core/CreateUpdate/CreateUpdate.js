const commons = require('../../monday-commons');
const { createUpdate } = require('../../queries');

/**
 * Component for making API requests.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { id, body } = context.messages.in.content;
        const data = await commons.makeRequest({
            query: createUpdate,
            options: {
                variables: {
                    itemId: +id,
                    body
                }
            },
            apiKey: context.auth.apiKey,
            context
        });

        await context.sendJson(data['create_update'], 'out');
    }
};
