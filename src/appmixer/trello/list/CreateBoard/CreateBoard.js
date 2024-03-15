'use strict';
const commons = require('../../trello-commons');

/**
 * Component for adding a board.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let boardInfo = context.messages.in.content;
        const { data: newBoard } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            url: `https://api.trello.com/1/boards?${commons.getAuthQueryParams(context)}`,
            data: {
                name: boardInfo['name'],
                desc: boardInfo['description']
            }
        });

        return context.sendJson(newBoard, 'board');
    }
};

