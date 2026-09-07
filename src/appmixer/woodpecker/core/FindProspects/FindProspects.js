'use strict';

const lib = require('../../lib');

const schema = {
    id: { type: 'integer', title: 'Prospect ID', example: 987654 },
    email: { type: 'string', title: 'Email', example: 'john@acme.com' },
    first_name: { type: 'string', title: 'First Name', example: 'John' },
    last_name: { type: 'string', title: 'Last Name', example: 'Smith' },
    company: { type: 'string', title: 'Company', example: 'Acme Inc.' },
    status: { type: 'string', title: 'Status', example: 'ACTIVE' },
    title: { type: 'string', title: 'Title', example: 'CTO' },
    industry: { type: 'string', title: 'Industry', example: 'Software' }
};

module.exports = {

    async receive(context) {

        const { email, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Prospects', value: 'result' });
        }

        const params = {};
        if (email) {
            params.email = email;
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${lib.API_BASE_URL}/v2/prospects`,
            headers: lib.getHeaders(context),
            params
        });

        const prospects = Array.isArray(data) ? data : (data.prospects || data.data || []);

        if (prospects.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputType, records: prospects });
    }
};
