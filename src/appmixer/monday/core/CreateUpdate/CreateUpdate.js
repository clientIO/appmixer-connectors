const commons = require('../../monday-commons');

/**
 * Component for making API requests.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const CreateUpdate =
            `mutation create_update (
            $itemId: ID
            $body: String!
        ) {
        create_update (
            item_id: $itemId
            body: $body 
        ) {
            id
        }
        }`;

        const { id, body } = context.messages.in.content;
        const data = await commons.makeRequest({
            query: CreateUpdate,
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
