const TTL_LOOKUP_OPTIONS = 60 * 1000; // 1 minute for inspector variables

module.exports = {

    async receive(context) {

        const { targets, isSource } = context.messages.in.content;

        if (!isSource) {
            throw new context.CancelError('This component is only available as a source.');
        }

        // Currently not supporting multiple targets.
        const entityName = targets[0];
        if (!entityName) {
            throw new context.CancelError('Entity name not specified. Check "targets" property.');
        }

        const resource = context.resource || context.auth.resource;
        const cacheKey = 'ms-dynamics-' + resource + '-' + entityName + '-lookup-options';

        let lock;
        try {
            lock = await context.lock(context.flowId, { retryDelay : 1000 });

            const itemsCached = await context.staticCache.get(cacheKey);
            if (itemsCached) {
                return context.sendJson(itemsCached, 'out');
            }

            // Get Entity metadata for the selected Entity (entityName).
            const { data: entityMetadata } = await context.httpRequest({
                url: `${resource}/api/data/v9.2/EntityDefinitions(LogicalName='${entityName}')?$select=LogicalCollectionName,PrimaryNameAttribute,PrimaryIdAttribute`,
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
                    accept: 'application/json'
                }
            });

            // Call Dynamics 365 Web API to retrieve the list of records for the selected Entity.
            const { data: records } = await context.httpRequest({
                url: `${resource}/api/data/v9.2/${entityMetadata.LogicalCollectionName}?$select=${entityMetadata.PrimaryIdAttribute},${entityMetadata.PrimaryNameAttribute}`,
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
                    accept: 'application/json'
                }
            });

            const items = records.value.map((record) => ({
                // Value should be in format "/accounts(00000000-0000-0000-0000-000000000000)"
                value: `/${entityMetadata.LogicalCollectionName}(${record[entityMetadata.PrimaryIdAttribute]})`,
                label: record[entityMetadata.PrimaryNameAttribute]
            }));

            await context.staticCache.set(
                cacheKey,
                items,
                context.config?.listLookupOptionsCacheTTL || TTL_LOOKUP_OPTIONS
            );

            // Returning values into another component.
            return context.sendJson(items, 'out');
        } finally {
            lock?.unlock();
        }
    }
};
