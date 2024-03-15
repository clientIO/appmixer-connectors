'use strict';
const commons = require('../../trello-commons');

/**
 * Component for adding a member to card
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let { boardListCardId, boardMemberId } = context.messages.in.content;
        const { data: newMembers } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            url: `https://api.trello.com/1/cards/${boardListCardId}/idMembers?${commons.getAuthQueryParams(context)}`,
            data: {
                value: boardMemberId
            }
        });
        if (Array.isArray(newMembers)) {
            return Promise.map(newMembers, newMember => {
                newMember.idCard = boardListCardId;
                return context.sendJson(newMember, 'member');
            });
        }
    }
};

