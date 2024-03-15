'use strict';
const commons = require('../../trello-commons');

/**
 * Component for finding specific board according to name.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            url: `https://api.trello.com/1/members/me/boards?${commons.getAuthQueryParams(context)}`
        });

        // Find board by id.
        let found = false;
        for (let board of data) {
            if (board['name'].indexOf(context.messages.in.content.name) > -1) {
                const { data } = await context.httpRequest({
                    headers: { 'Content-Type': 'application/json' },
                    url: `https://api.trello.com/1/boards/${board['id']}?${commons.getAuthQueryParams(context)}`
                });
                found = true;

                return context.sendJson(data, 'board');
            }
        }
        if (!found) {
            return context.sendJson({ searchTerm: context.messages.in.content.name }, 'notFound');
        }
    }
};

