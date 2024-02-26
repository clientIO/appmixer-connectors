'use strict';
const ZohoClient = require('../../ZohoClient');

const outputInspector = async (context) => {

    const { allAtOnce, moduleName } = context.messages.in.content;
    if (allAtOnce) {
        return context.sendJson([{ label: moduleName , value: 'records' }], 'out');
    }
    const fields = await context.componentStaticCall(
        'appmixer.zoho.crm.ListFields',
        'fields',
        {
            messages: { in: { moduleName } },
            transform: './transformers#toSelectArray'
        }
    );

    let output = [
        {
            label: 'Index',
            value: 'index'
        },
        {
            label: `${moduleName} object`,
            value: 'record'
        }
    ];

    fields.forEach(field => {
        output.push({
            label: field.label,
            value: `record.${field.value}`
        });
    });

    return context.sendJson(output, 'out');

};

/**
 * Component for listing CRM records.
 */
module.exports = {

    async receive(context) {

        const { generateOutputPortOptions } = context.properties;
        if (generateOutputPortOptions) {
            return outputInspector(context);
        }

        const { moduleName, allAtOnce, ids } = context.messages.in.content;
        const params = {};
        if (ids) {
            params['ids'] = ids;
        }
        const records = await (new ZohoClient(context)).getRecords(moduleName, { params });

        if (allAtOnce) {
            return context.sendJson({ records }, 'out');
        }

        let index = 0;
        for (const record of records) {
            await context.sendJson({ record, index }, 'out');
            index++;
        }
    }
};
