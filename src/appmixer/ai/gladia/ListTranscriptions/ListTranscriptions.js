'use strict';

const lib = require('../lib');

const PAGE_SIZE = 50;
const MAX_RECORDS = 500;

const schema = {
    'id': { 'type': 'string', 'title': 'Job ID' },
    'status': { 'type': 'string', 'title': 'Status' },
    'kind': { 'type': 'string', 'title': 'Kind' },
    'created_at': { 'type': 'string', 'title': 'Created At' },
    'completed_at': { 'type': 'string', 'title': 'Completed At' },
    'result_url': { 'type': 'string', 'title': 'Result URL' }
};

module.exports = {
    async receive(context) {

        const { outputType, status } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Transcriptions' });
        }

        // The list endpoint pages with offset/limit and exposes a `next` URL when
        // more pages remain. We page until a short page is returned, `next` is
        // null, or we reach MAX_RECORDS.
        const records = [];
        let offset = 0;

        while (records.length < MAX_RECORDS) {
            const params = { limit: PAGE_SIZE, offset };
            if (status) {
                params.status = status;
            }

            const data = await lib.makeRequest({
                context,
                method: 'GET',
                path: '/v2/transcription',
                params
            });

            const page = (data && data.items) || [];
            records.push(...page);

            if (page.length < PAGE_SIZE || !(data && data.next)) {
                break;
            }
            offset += PAGE_SIZE;
        }

        return lib.sendArrayOutput({ context, records: records.slice(0, MAX_RECORDS), outputType });
    }
};
