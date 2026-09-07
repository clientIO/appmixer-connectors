'use strict';

const lib = require('../../lib');

const schema = {
    id: { type: 'integer', title: 'Campaign ID' },
    name: { type: 'string', title: 'Name' },
    status: { type: 'string', title: 'Status' },
    created: { type: 'string', title: 'Created' },
    from_name: { type: 'string', title: 'From Name' },
    timezone: { type: 'string', title: 'Timezone' }
};

module.exports = {

    async receive(context) {

        const { status, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Campaigns', value: 'result' });
        }

        const params = {};
        if (status) {
            params.status = status;
        }

        // Campaign listing lives on the v1 API (GET /v2/campaigns responds 405);
        // an account with no campaigns responds 204 with an empty body.
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${lib.API_BASE_URL}/v1/campaign_list`,
            headers: lib.getHeaders(context),
            params
        });

        const campaigns = Array.isArray(data) ? data : (data && (data.campaigns || data.data)) || [];

        return lib.sendArrayOutput({ context, outputType, records: campaigns });
    }
};
