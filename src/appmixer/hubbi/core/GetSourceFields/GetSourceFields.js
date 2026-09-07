'use strict';

const lib = require('../../lib');

const SCHEMA = {
    name: { type: 'string', title: 'Field Name', example: 'Email' },
    type: { type: 'string', title: '.NET Type', example: 'String' },
    required: { type: 'boolean', title: 'Required', example: false },
    inspectorType: { type: 'string', title: 'Inspector Type', example: 'text' },
    schemaType: { type: 'string', title: 'JSON Schema Type', example: 'string' }
};

module.exports = {

    async receive(context) {

        const { conversionKey, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, SCHEMA, { label: 'Source Fields', value: 'result' });
        }

        if (!conversionKey) {
            throw new context.CancelError('Hub (Conversion Key) is required!');
        }

        const fields = await lib.getFields(context, lib.ENDPOINTS.sourceFields, conversionKey);

        return lib.sendArrayOutput({ context, outputType, records: fields });
    }
};
