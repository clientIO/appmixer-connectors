'use strict';
const CSVProcessor = require('../CSVProcessor');

module.exports = {

    async receive(context) {

        const {
            initialContent = '',
            fileId,
            delimiter = ','
        } = context.properties;

        if (fileId) {
            const processor = new CSVProcessor(context, fileId, {
                delimiter
            });

            const objectHeaders = await CSVProcessor.getHeadersAsObject(processor);

            return context.sendJson(objectHeaders, 'out');
        } else {
            if (initialContent === '' || initialContent.match(/{{{\$.*}}}/)) {
                return context.sendJson({}, 'out');
            }

            const rows = initialContent.split('\n');
            const headersRow = rows[0];

            const headers = headersRow.split(delimiter);

            const objectHeaders = headers.reduce((acc, header) => {
                acc[header] = header;
                return acc;
            }, {});

            return context.sendJson(objectHeaders, 'out');
        }
    },

    outputHeaders(headers) {

        const output = [
            { label: 'fileId', value: 'fileId' }
        ];

        Object.keys(headers).forEach(header => {
            output.push({ label: `Column: ${header}`, value: headers[header] });
        });

        return output;
    }
};
