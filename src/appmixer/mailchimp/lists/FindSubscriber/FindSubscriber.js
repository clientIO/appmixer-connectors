'use strict';
const mailchimpDriver = require('../../commons');

/**
 * Component finds subscriber in a list.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let { listId, query } = context.messages.in.content;

        let response = await mailchimpDriver.search.members(context, {
            listId,
            query,
            offset: 0
        });

        if (response) {
            const matches = [...response.full_search.members, ...response.exact_matches.members];
            return Promise.all(matches.map(member => context.sendJson(member, 'out')));
        }
    }
};
