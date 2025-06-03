
module.exports = {
    async receive(context) {
        const { contactGroupId, resourceNamesToAdd, resourceNamesToRemove } = context.messages.in.content;

        // https://developers.google.com/people/api/rest/v1/contactGroups/members/batchModify
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://people.googleapis.com/v1/contactGroups/{contactGroupId}/members:batchModify',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
