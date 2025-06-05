module.exports = {
    async receive(context) {
        const { groupId, name } = context.messages.in.content;

        const { data: currentData } = await context.httpRequest({
            method: 'GET',
            url: `https://people.googleapis.com/v1/contactGroups/${groupId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        const { data } = await context.httpRequest({
            method: 'PUT',
            url: `https://people.googleapis.com/v1/contactGroups/${groupId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            body: {
                contactGroup: {
                    etag: currentData.etag,
                    name
                }
            }
        });

        const betterResponse = {
            id: data.resourceName.split('/')[1],
            etag: data.etag,
            updateTime: data.metadata.updateTime,
            groupType: data.groupType,
            name: data.name,
            formattedName: data.formattedName
        };

        return context.sendJson(betterResponse, 'out');
    }
};
