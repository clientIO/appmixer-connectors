const commons = require('../salesforce-commons');
const _ = require('lodash');

module.exports = {

    async receive(context) {

        if (context.properties.generateInspector) {
            return generateInspector(context);
        }

        const {
            id,
            json,
            rawJson,
            objectName
        } = context.messages.in.content;

        let objectRecord;

        if (rawJson) {
            try {
                objectRecord = JSON.parse(json);
            } catch (e) {
                throw new context.CancelError(`The input JSON is invalid: ${json}`);
            }
        } else {
            objectRecord = _.omit(context.messages.in.content, ['objectName', 'rawJson', 'id']);
        }

        await context.log({ stage: 'Updating Object record', objectRecord });

        // '204 No Content' on success
        await commons.api.salesForceRq(context, {
            method: 'PATCH',
            action: `sobjects/${objectName}/${id}`,
            data: JSON.stringify(objectRecord),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return context.sendJson({}, 'out');
    }
};

async function generateInspector(context) {

    const {
        objectName,
        rawJson
    } = context.properties;

    const required = ['objectName'];
    if (rawJson) {
        required.push('json');
    }
    const schema = {
        type: 'object',
        properties: {
            objectName: { type: 'string' },
            rawJson: { type: 'boolean' },
            json: { type: 'string' }
        },
        required
    };

    let fieldsInputs = {};

    if (objectName && !rawJson) {
        const objectPropertiesCacheTTL = context.config.objectPropertiesCacheTTL || (5 * 60 * 1000);
        const cacheKey = 'salesforce_properties_objectFields_' + objectName + '_' + context.auth.userId + context.auth.profileInfo.email;
        let lock;
        try {
            lock = await context.lock(cacheKey);
            const cached = await context.staticCache.get(cacheKey);
            if (cached) {
                fieldsInputs = cached;
            } else {
                const fields = await commons.api.getObjectFields(context, { objectName });

                fieldsInputs = fields.reduce((res, item, index) => {

                    // IMPORTANT - we can list properties, which we actually can update
                    if (item.updateable) {
                        res[item.name] = {
                            index: index + 3,
                            type: 'text',
                            name: item.name,
                            label: item.name,
                            tooltip: item.label || item.name
                        };
                    }
                    return res;
                }, {});

                await context.staticCache.set(cacheKey, fieldsInputs, objectPropertiesCacheTTL);
            }
        } finally {
            lock?.unlock();
        }

    }

    const inputs = {

        objectName: {
            label: 'Object Name',
            index: 1,
            type: 'select',
            source: {
                url: '/component/appmixer/salesforce/crm/ListObjects?outPort=out',
                data: {
                    'transform': './transformers#toSelectArray',
                    properties: {
                        onlyUpdateable: true
                    }
                }
            },
            tooltip: 'Select object name.'
        },
        id: {
            type: 'text',
            label: 'Object Id',
            tooltip: 'The identifier of the object. For example, 001R0000005hDFYIA2.',
            index: 2
        },
        rawJson: {
            type: 'toggle',
            label: 'Input as raw JSON.',
            defaultValue: false,
            tooltip: 'Enable the toggle to set the input to raw JSON.',
            index: 3
        },
        json: {
            type: 'text',
            label: 'JSON',
            tooltip: 'The JSON representation of the object to create.',
            when: { 'eq': { './rawJson': true } },
            index: 4
        },

        ...fieldsInputs
    };

    return context.sendJson({
        schema,
        inputs
    }, 'out');
}
