'use strict';

const lib = require('../../lib');

const schema = {
    'user_id': { 'type': 'string', 'title': 'User ID' },
    'name': { 'type': 'string', 'title': 'Name' },
    'email': { 'type': 'string', 'title': 'Email' },
    'is_admin': { 'type': 'boolean', 'title': 'Is Admin' },
    'num_transcripts': { 'type': 'integer', 'title': 'Number of Transcripts' },
    'minutes_consumed': { 'type': 'number', 'title': 'Minutes Consumed' }
};

module.exports = {
    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Users' });
        }

        const query = `
            query {
                users {
                    user_id
                    name
                    email
                    is_admin
                    num_transcripts
                    minutes_consumed
                }
            }
        `;

        const data = await lib.makeRequest({ context, query });
        const records = (data && data.users) || [];

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
