'use strict';

const lib = require('../../lib');

// The inspector is generated from the selected hub's SourceFields, so the input form changes
// depending on which hub is picked (there is no static field list). A "raw JSON" toggle lets the
// user supply a full array of records for bulk pushes instead of the generated per-field inputs.
async function generateInspector(context) {

    const conversionKey = context.properties.conversionKey;
    const rawJson = context.properties.rawJson;
    const keyPicked = conversionKey && conversionKey.toString().indexOf('{{') === -1;

    let fields = [];
    if (keyPicked && !rawJson) {
        fields = await lib.getFields(context, lib.ENDPOINTS.sourceFields, conversionKey);
    }

    const inputs = {
        conversionKey: {
            type: 'text',
            label: 'Hub',
            index: 0,
            tooltip: 'The hub to start (conversion key). Pick from the list or type a conversion key by hand.',
            source: {
                url: '/component/appmixer/hubbi/core/ListSourceHubsWithPostData?outPort=out',
                data: {
                    messages: { 'in/outputType': 'array' },
                    transform: './ListSourceHubsWithPostData#toSelectArray'
                }
            }
        },
        rawJson: {
            type: 'toggle',
            label: 'Input records as raw JSON',
            index: 1,
            defaultValue: false,
            tooltip: 'Turn on to provide a JSON array of records (useful for bulk pushes). Turn off to fill the hub fields one by one.'
        }
    };

    const schema = {
        conversionKey: { type: 'string' },
        rawJson: { type: 'boolean' }
    };

    if (rawJson) {
        inputs.records = {
            type: 'textarea',
            label: 'Records (JSON array)',
            index: 2,
            tooltip: 'A JSON array of record objects, e.g. [{"Email":"a@b.com"},{"Email":"c@d.com"}].'
        };
        schema.records = { type: 'string' };
    } else {
        Object.assign(inputs, lib.fieldsToInspectorInputs(fields, 10));
        Object.assign(schema, lib.fieldsToInspectorSchema(fields));
    }

    return context.sendJson({ schema, inputs }, 'out');
}

module.exports = {

    async receive(context) {

        if (context.properties.generateInspector) {
            return generateInspector(context);
        }

        const content = context.messages.in.content || {};
        const { conversionKey, rawJson, records: rawRecords, ...fieldValues } = content;

        if (!conversionKey) {
            throw new context.CancelError('Hub (Conversion Key) is required!');
        }

        let records;
        if (rawJson) {
            try {
                records = typeof rawRecords === 'object' ? rawRecords : JSON.parse(rawRecords || '[]');
            } catch (err) {
                throw new context.CancelError('Records must be a valid JSON array.');
            }
            if (!Array.isArray(records)) {
                records = [records];
            }
        } else {
            const record = {};
            Object.keys(fieldValues).forEach(key => {
                const value = fieldValues[key];
                if (value !== undefined && value !== null && value !== '') {
                    record[key] = value;
                }
            });
            records = [record];
        }

        // HubsStartWithData takes a JSON array body — all records go in one request.
        await lib.hubbiRequest(context, {
            method: 'POST',
            endpoint: lib.ENDPOINTS.hubsStartWithData,
            conversionKey,
            body: records
        });

        return context.sendJson({ conversionKey, recordsCount: records.length }, 'out');
    }
};
