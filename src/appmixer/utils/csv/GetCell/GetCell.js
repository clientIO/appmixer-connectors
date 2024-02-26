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
            index,
            column,
            columnIndex,
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

        const rows = await processor.getRows(options);
        let row = rows[0] || null;

        let targetIndex;

        if (withHeaders) {
            targetIndex = processor.getHeaderIndex(column);
        } else {
            targetIndex = columnIndex;
        }

        const cell = row[targetIndex];

        return context.sendJson({ fileId, cell }, 'out');
    }
};
