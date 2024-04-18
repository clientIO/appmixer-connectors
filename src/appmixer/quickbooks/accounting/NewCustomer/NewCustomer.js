'use strict';

const { makeRequest } = require('../../commons');

module.exports = {

    async tick(context) {

        let { changedSince } = await context.stateGet('changedSince') || {};

        if (!changedSince) {
            // On first tick, fetch only the most recent update to set changedSince
            changedSince = new Date();
            await context.stateSet('changedSince', { changedSince });
        }

        const options = {
            path: `v3/company/${context.profileInfo.companyId}/cdc?entities=Customer&changedSince=${changedSince.toISOString()}`,
            method: 'GET'
        };

        try {
            const { data } = await makeRequest({ context, options });

            // Empty response: {"CDCResponse": [{"QueryResponse": [{}]}],"time": "2024-04-18T05:12:07.655-07:00"}
            if (data.CDCResponse[0].QueryResponse.length > 0 && data.CDCResponse[0].QueryResponse[0].Customer) {
                for (const entity of data.CDCResponse[0].QueryResponse[0].Customer) {
                    // Compare MetaData.CreateTime with MetaData.LastUpdatedTime to determine if the entity is new or updated
                    const isNew = entity.MetaData.CreateTime === entity.MetaData.LastUpdatedTime;
                    if (isNew) {
                        await context.sendJson(entity, 'out');
                    }
                }
            }

            // Finally update changedSince to the latest time in the response
            changedSince = new Date(data.time);
            await context.stateSet('changedSince', { changedSince });
        } catch (error) {
            await context.log({ step: 'Error executing query', error });
            throw new context.CancelError('Error executing query: ' + error);
        }
    }
};
