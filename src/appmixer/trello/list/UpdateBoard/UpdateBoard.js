'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Component for update an existing board
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let boardInfo = context.messages.in.content;
        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let updateCard = Promise.promisify(client.put, { context: client });

        return updateCard(
            `/1/boards/${boardInfo.boardId}`,
            {
                name: boardInfo['name'],
                desc: boardInfo['description']
            }
        ).then(updatedBoard => {
            return context.sendJson(updatedBoard, 'board');
        });
    }
};

