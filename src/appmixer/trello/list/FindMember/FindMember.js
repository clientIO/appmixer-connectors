'use strict';
const commons = require('../../trello-commons');

/**
 * Component for finding specific member of a board.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let { name, boardId } = context.messages.in.content;
        let boards = [];

        if (!boardId) {
            const { data } = await context.httpRequest({
                headers: { 'Content-Type': 'application/json' },
                url: `https://api.trello.com/1/members/me/boards?${commons.getAuthQueryParams(context)}`
            });
            boards = data.map(board => board.id);
        } else {
            boards = [boardId];
        }

        let members = [];
        for (const boardId of boards) {
            const { data } = await context.httpRequest({
                headers: { 'Content-Type': 'application/json' },
                url: `https://api.trello.com/1/boards/${boardId}/members?${commons.getAuthQueryParams(context)}`
            });
            members.push(...data);
        }

        members = members.filter((member, index, arr) => arr.findIndex(m => m.id === member.id) === index);
        members = members.filter(member => name === member['fullName']);

        if (!members.length) {
            return context.sendJson({ name }, 'notFound');
        }

        for (const member of members) {
            const { data } = await context.httpRequest({
                headers: { 'Content-Type': 'application/json' },
                url: `https://api.trello.com/1/members/${member['id']}?${commons.getAuthQueryParams(context)}`
            });
            context.sendJson(data, 'member');
        }
    }
};
