'use strict';
const commons = require('../../monday-commons');
const queries = require('../../queries');

/**
 * Component for fetching list of groups.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const data = await commons.makeRequest({
            query: queries.listGroups,
            options: {
                variables: { boardId: +(context.messages.in.content.boardId) }
            },
            apiKey: context.auth.apiKey
        });
        const groups = data.boards[0] && data.boards[0].groups;
        return context.sendJson({ groups }, 'out');
    },

    groupsToSelectArray({ groups }) {

        return groups.map(group => {
            return { label: group.title, value: group.id };
        });
    }
};

