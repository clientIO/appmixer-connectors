'use strict';

module.exports = {
    async receive(context) {

        const { boardId } = context.messages.in.content;
        //if board id is not there then dont do anything
        if (!boardId) {
            return context.sendJson([], 'out');
        }
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://api.pinterest.com/v5/boards/${boardId}/sections`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });
        return context.sendJson(data.items, 'out');
    },

    sectionsToSelectArray(sections) {
        if (!Array.isArray(sections)) return [];
        return sections.map(item => ({
            label: item.name || 'Unnamed Board',
            value: item.id || ''
        }));
    }
};
