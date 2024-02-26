'use strict';
const ZohoClient = require('../../ZohoClient');

/**
 * Find lead by email.
 */
module.exports = {

    async receive(context) {

        const { email } = context.messages.query.content;
        const client = new ZohoClient(context);
        const results = await client.search('Leads', { email });

        if (Array.isArray(results) && results.length) {
            const lead = results.pop();
            return context.sendJson(lead, 'lead');
        }
        return context.sendJson({ email }, 'notFound');

    }
};
