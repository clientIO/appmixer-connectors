'use strict';

const commons = require('../../trello-commons');

module.exports = {

    async receive(context) {

        const { boardCardId } = context.messages.in.content;
        await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'DELETE',
            url: `https://api.trello.com/1/cards/${boardCardId}?${commons.getAuthQueryParams(context)}`
        });

        return context.sendJson({}, 'card');
    }
};
