'use strict';
const ZohoClient = require('../../ZohoClient');

module.exports = {

    async receive(context) {

        const { contact_id, organization_id } = context.messages.in.content;
        const zc = new ZohoClient(context);
        const result = await zc.request('DELETE', '/books/v3/contacts/' + contact_id, { params: { organization_id } });

        return context.sendJson(result, 'out');
    }
};
