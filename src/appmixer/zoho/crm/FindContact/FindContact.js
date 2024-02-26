'use strict';
const ZohoClient = require('../../ZohoClient');

/**
 * Find contact.
 */
module.exports = {

    async receive(context) {

        const { email } = context.messages.query.content;
        const client = new ZohoClient(context);
        const results = await client.search('Contacts', { email });

        if (Array.isArray(results) && results.length) {
            const contact = results.pop();
            return context.sendJson(contact, 'contact');
        }
        return context.sendJson({ email }, 'notFound');

    }
};
