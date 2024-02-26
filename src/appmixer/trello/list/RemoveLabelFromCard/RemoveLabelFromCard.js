'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Component for remove a label from card
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let removeLabel = Promise.promisify(client.del, { context: client });

        return removeLabel(
            `/1/cards/${context.messages.in.content.boardListCardId}/idLabels/` +
            `${context.messages.in.content.labelId}`
        ).then(res => {
            return context.sendJson(res, 'out');
        });
    }
};
