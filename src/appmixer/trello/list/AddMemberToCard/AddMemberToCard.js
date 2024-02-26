'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Component for adding a member to card
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { boardListCardId, boardMemberId } = context.messages.in.content;
        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let addMemberToCard = Promise.promisify(client.post, { context: client });

        return addMemberToCard(
            '/1/cards/' + boardListCardId + '/idMembers',
            { 'value': boardMemberId }
        ).then(newMembers => {
            if (Array.isArray(newMembers)) {
                return Promise.map(newMembers, newMember => {
                    newMember.idCard = boardListCardId;
                    return context.sendJson(newMember, 'member');
                });
            }
        });
    }
};

