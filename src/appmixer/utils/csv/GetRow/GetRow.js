'use strict';
const CSVProcessor = require('../CSVProcessor');
const { expressionTransformer } = require('../helpers');

module.exports = {

    async receive(context) {

        const { withHeaders } = context.properties;

        const {
            fileId,
            delimiter,
            filters,
            rowFormat,
            index,
            parseNumbers,
            parseBooleans
        } = context.messages.in.content;

        const processor = new CSVProcessor(context, fileId, {
            withHeaders,
            delimiter,
            parseNumbers,
            parseBooleans
        });

        const options = {
            stopOnFirstMatch: true
        };

        if (withHeaders) {
            options.filters = expressionTransformer(filters);
        } else {
            options.indexExpression = index;
        }

        let rows = await processor.getRows(options);

        if (rowFormat === 'object' && withHeaders) {
            rows = rows.map(row => processor.mapRow(row));
        }

        const row = rows[0] || null;

        return context.sendJson({ fileId, row }, 'out');
    }
};
