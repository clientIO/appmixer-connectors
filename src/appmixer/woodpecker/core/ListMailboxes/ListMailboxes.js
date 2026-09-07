'use strict';

const lib = require('../../lib');

const schema = {
    id: { type: 'integer', title: 'Mailbox ID', example: 4455 },
    email: { type: 'string', title: 'Email', example: 'outreach@acme.com' },
    from_name: { type: 'string', title: 'From Name', example: 'Jane Doe' },
    signature: { type: 'string', title: 'Signature', example: 'Best, Jane' },
    daily_limit: { type: 'integer', title: 'Daily Limit', example: 50 }
};

module.exports = {

    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Mailboxes', value: 'result' });
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${lib.API_BASE_URL}/v2/mailboxes`,
            headers: lib.getHeaders(context)
        });

        const mailboxes = Array.isArray(data) ? data : (data.mailboxes || data.data || []);

        // The API nests mailbox fields under `details` — flatten to match the declared schema.
        const records = mailboxes.map(({ details, ...rest }) => ({ ...rest, ...details }));

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
