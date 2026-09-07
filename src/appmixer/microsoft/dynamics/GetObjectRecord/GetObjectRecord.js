const { getEntitySetName, DEFAULT_ENTITIES } = require('../dynamics-commons');

module.exports = {

    async receive(context) {

        // Source for the Object Name typeahead - just the curated default entities, no API call.
        if (context.properties.listDefaultEntities) {
            return context.sendJson(DEFAULT_ENTITIES, 'out');
        }

        const { id, objectName } = context.messages.in.content;

        if (!objectName) {
            throw new context.CancelError('Object Name is required!');
        }
        if (!id) {
            throw new context.CancelError('ID is required!');
        }

        // Resolve the real collection segment from metadata - a naive `${objectName}s`
        // breaks for irregular plurals (opportunity -> opportunities).
        const entitySet = await getEntitySetName(context, objectName);

        const options = {
            url: `${context.resource || context.auth.resource}/api/data/v9.2/${entitySet}(${id})`,
            method: 'GET',
            headers: {
                Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
                accept: 'application/json',
                'content-type': 'application/json'
            }
        };

        const { data } = await context.httpRequest(options);

        return context.sendJson(data, 'out');
    }
};
