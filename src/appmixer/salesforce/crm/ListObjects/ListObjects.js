/**
 * Component for fetching list of contacts fields.
 * @extends {Component}
 */
const commons = require('../salesforce-commons');

module.exports = {

    async receive(context) {
        const {
            outputType,
            customOnly
        } = context.messages.in.content;
        const { generateOutputPortOptions, onlyCreateable, onlyUpdateable } = context.properties;

        if (generateOutputPortOptions) {
            return getOutputPortOptions(context, outputType);
        }

        // This is a private component, no need to check if the call is from another component
        const cacheKeyPrefix = 'salesforce_objects_listObjects_';
        let lock;
        try {
            let cacheKeySuffix = 'all';
            if (onlyCreateable) {
                cacheKeySuffix = 'createable';
            }
            if (onlyUpdateable) {
                cacheKeySuffix = 'updateable';
            }
            const cacheKey = cacheKeyPrefix + cacheKeySuffix + '_' + context.auth.userId + context.auth.profileInfo.email;
            lock = await context.lock(cacheKey);

            const objectsCached = await context.staticCache.get(cacheKey);
            if (objectsCached) {
                return context.sendJson({ result: objectsCached }, 'out');
            }

            const { data } = await commons.api.salesForceRq(context, {
                action: 'sobjects'
            });

            const sobjects = data.sobjects || [];
            const customSoObjects = sobjects
                .filter(item => !customOnly || item.custom)
                .filter(item => !onlyCreateable || item.createable)
                .filter(item => !onlyUpdateable || item.updateable);

            await context.staticCache.set(
                cacheKey,
                customSoObjects,
                context.config.listObjectsCacheTTL || (20 * 1000)
            );

            return commons.sendArrayOutput({
                context,
                outputPortName: 'out',
                outputType,
                records: customSoObjects
            });
        } finally {
            lock?.unlock();
        }
    }
};

const getOutputPortOptions = async (context, outputType) => {

    if (outputType === 'object') {

        const output = [
            { label: 'label', value: 'label' },
            { label: 'name', value: 'name' }
        ];

        return context.sendJson(output, 'out');
    } else if (outputType === 'array') {
        return context.sendJson([{ label: 'Result', value: 'result' }], 'out');
    } else {
        // file
        return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
    }
};
