'use strict';

async function getErrors(context, now, errors = [], from = 0, size = 100) {

    const result = await context.callAppmixer({
        endPoint: '/logs',
        method: 'GET',
        qs: {
            from,
            size,
            sort: 'gridTimestamp:asc',
            query: `@timestamp:[${context.state.since} TO ${now}] AND severity:error`,
            flowId: context.flowId
        }
    });

    errors = errors.concat(result.hits);

    if (result.hits.length === 0 || result.hits.length < size) {
        return errors;
    }

    return getErrors(context, now, errors, result.nextFrom, size);
}

/**
 * Add Flow name and component labels to those errors.
 * @param {Context} context
 * @param {Array} errors
 */
function addLabels(context, errors) {

    return errors.map(err => {
        return Object.assign(
            err,
            {
                flowName: context.flowInfo.flowName
            },
            err.componentId ? {
                componentLabel: context.flowDescriptor[err.componentId].label || err.componentType.split('.')[3]
            } : {});
    });
}

module.exports = {

    async start(context) {

        return context.saveState({ since: new Date().toISOString() });
    },

    async tick(context) {

        const now = new Date().toISOString();
        const errors = await getErrors(context, now);
        await context.sendArray(addLabels(context, errors), 'out');
        return context.saveState({ since: now });
    }
};
