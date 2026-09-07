'use strict';

module.exports = {

    async receive(context) {

        const { spaceId, folderId } = context.messages.in.content;

        if (!spaceId && !folderId) {
            // As a dynamic source the Space ID may not be resolvable yet
            // (an empty field, or a value bound to a flow variable) — answer
            // with an empty list instead of failing the picker.
            if (context.properties.variableFetch) {
                return context.sendJson({ lists: [] }, 'out');
            }
            throw new context.CancelError('Space ID is required');
        }

        const url = folderId ?
            `https://api.clickup.com/api/v2/folder/${folderId}/list` :
            `https://api.clickup.com/api/v2/space/${spaceId}/list`;

        try {
            const { data } = await context.httpRequest({
                method: 'GET',
                url,
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`
                }
            });

            return context.sendJson({ lists: data.lists || [] }, 'out');
        } catch (err) {
            if (context.properties.variableFetch) {
                return context.sendJson({ lists: [] }, 'out');
            }
            throw err;
        }
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
