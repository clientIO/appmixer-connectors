'use strict';
const CSVProcessor = require('../CSVProcessor');
const { expressionTransformer } = require('../helpers');

module.exports = {

    async receive(context) {

        const {
            withHeaders,
            filterRows
        } = context.properties;

        const {
            fileId,
            delimiter,
            filters,
            rowFormat,
            indexes,
            allAtOnce,
            parseNumbers,
            parseBooleans
        } = context.messages.in.content;

        // Don't know why allAtOnce arrives as a string, so this is a hotfix
        let boolAllAtOnce = allAtOnce;
        if (typeof allAtOnce === 'string') {
            boolAllAtOnce = allAtOnce === 'true';
        }

        const processor = new CSVProcessor(context, fileId, {
            withHeaders,
            delimiter,
            parseNumbers,
            parseBooleans
        });

        const options = {
            getAllRows: !filterRows
        };

        if (filterRows) {
            if (withHeaders) {
                options.filters = expressionTransformer(filters);
            } else {
                options.indexExpression = indexes;
            }
        }

        let rows = await processor.getRows(options);

        if (rowFormat === 'object' && withHeaders) {
            rows = rows.map(row => processor.mapRow(row));
        }

        if (boolAllAtOnce) {
            return context.sendJson({ fileId, rows }, 'out');
        } else {
            for (let row of rows) {
                await context.sendJson({ fileId, rows: row }, 'out');
            }
        }
    }
};
