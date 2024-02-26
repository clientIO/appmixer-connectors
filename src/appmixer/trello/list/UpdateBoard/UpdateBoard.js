'use strict';
const commons = require('../../trello-commons');

/**
 * Component for update an existing board
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let boardInfo = context.messages.in.content;
        const { data: updatedBoard } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'PUT',
            url: `https://api.trello.com/1/boards/${boardInfo.boardId}?${commons.getAuthQueryParams(context)}`,
            data: {
                name: boardInfo['name'],
                desc: boardInfo['description']
            }
        });

        return context.sendJson(updatedBoard, 'board');
    }
};

