'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Component for adding a board.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let boardInfo = context.messages.in.content;
        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let createBoard = Promise.promisify(client.post, { context: client });

        return createBoard(
            '/1/boards',
            {
                name: boardInfo['name'],
                desc: boardInfo['description']
            }
        ).then(newBoard => {
            return context.sendJson(newBoard, 'board');
        });
    }
};

