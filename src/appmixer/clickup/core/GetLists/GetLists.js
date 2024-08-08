'use strict';

module.exports = {
    async receive(context) {
        const { spaceId } = context.messages.in.content;
        const { data } = await context.httpRequest.get(`https://api.clickup.com/api/v2/space/${spaceId}/list`, {
            headers: {
                Authorization: context.auth.accessToken
            }
        });
        return context.sendJson({ lists: data.lists }, 'out');
    },

    toSelectArray(out) {
        return (out.lists || []).map(list => {
            return {
                label: list.name,
                value: list.id
            };
        });
    }
};
