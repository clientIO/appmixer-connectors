'use strict';

module.exports = {
    async receive(context) {

        // https://developers.pinterest.com/docs/api/v5/boards-list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.pinterest.com/v5/boards',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data.items, 'out');
    },

    boardsToSelectArray(boards) {
        if (!Array.isArray(boards)) return [];
        return boards.map(board => ({
            label: board.name || 'Unnamed Board',
            value: board.id || ''
        }));
    }
};
