const _ = require('lodash');
const { getEntitySetName, generateInspector, DEFAULT_ENTITIES } = require('../dynamics-commons');

module.exports = {

    async receive(context) {

        // Source for the Object Name typeahead - just the curated default entities, no API call.
        if (context.properties.listDefaultEntities) {
            return context.sendJson(DEFAULT_ENTITIES, 'out');
        }

        if (context.properties.generateInspector) {
            const inPort = await generateInspector(context, 'IsValidForUpdate');
            return context.sendJson(inPort, 'out');
        }

        const { id, json, rawJson, objectName } = context.messages.in.content;

        if (!objectName) {
            throw new context.CancelError('Object Name is required!');
        }
        if (!id) {
            throw new context.CancelError('ID is required!');
        }

        let objectRecord;

        if (rawJson) {
            try {
                objectRecord = JSON.parse(json);
            } catch (e) {
                throw new context.CancelError(`The input JSON is invalid: ${json}`);
            }
        } else {
            objectRecord = _.omit(context.messages.in.content, ['id', 'json', 'rawJson', 'objectName']);

            // Workaround to support Lookup fields with dots in the name.
            // Rename keys with @odata|bind to change the '|' back to '.'.
            // Example:
            // - Appmixer inspector field: 'parentaccountid@odata|bind'
            // - Dynamics 365 object key:  'parentaccountid@odata.bind'
            for (const key in objectRecord) {
                if (key.endsWith('@odata|bind')) {
                    const newKey = key.replace('@odata|bind', '@odata.bind');
                    objectRecord[newKey] = objectRecord[key];
                    delete objectRecord[key];
                }
            }
        }

        // Resolve the real collection segment from metadata - a naive `${objectName}s`
        // breaks for irregular plurals (opportunity -> opportunities).
        const entitySet = await getEntitySetName(context, objectName);

        const options = {
            url: `${context.resource || context.auth.resource}/api/data/v9.2/${entitySet}(${id})`,
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
                accept: 'application/json',
                'content-type': 'application/json'
            },
            data: objectRecord
        };

        try {
            const { data, headers, status, statusText } = await context.httpRequest(options);

            let newObjectId;
            const odataEntityId = headers['odata-entityid'];
            if (odataEntityId) {
                // Format: https://org422b05be.crm4.dynamics.com/api/data/v9.2/leads(2fa944ce-677d-ee11-8179-0022488947ed)
                newObjectId = odataEntityId.split('(')[1].split(')')[0];
            }

            return context.sendJson({ objectName, data, id: newObjectId, link: odataEntityId, status, statusText }, 'out');
        } catch (error) {
            // If Axios throws an error, the response is in error.response.data.
            const axiosError = error.response?.data;
            // This propagates the error properly when the component is called by a different component.
            error.message = `${error.message}: ${axiosError?.error?.message || axiosError?.message || ''}`;
            throw error;
        }
    }
};
