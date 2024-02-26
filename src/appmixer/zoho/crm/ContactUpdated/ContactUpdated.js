'use strict';
const ZohoNotifiable = require('../../ZohoNotifiable');

class ContactUpdated extends ZohoNotifiable {

    async receive(context) {

        let { ids } = context.messages.webhook.content.data;
        ids = ids.join(',');
        const moduleName = 'Contacts';
        const allAtOnce = true;
        const { records } = await context.componentStaticCall(
            'appmixer.zoho.crm.ListRecords',
            'out',
            {
                messages: { in: { moduleName, allAtOnce, ids } }
            }
        );
        for (const contact of records) {
            await context.sendJson(contact, 'contact');
        }

    }
}

const events = [
    'Contacts.edit'
];

/**
 * Component which triggers whenever new contact is updated
 */
module.exports = new ContactUpdated(events);
