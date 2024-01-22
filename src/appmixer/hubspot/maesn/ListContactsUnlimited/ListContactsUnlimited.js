'use strict';
const Hubspot = require('../../Hubspot');
const commons = require('../../commons');
// https://developers.hubspot.com/docs/api/crm/contacts#endpoint?spec=GET-/crm/v3/objects/contacts

module.exports = {

    async receive(context) {

        const {
            outputType,
            properties,
            search
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return getOutputPortOptions(context, outputType);
        }

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        let params = {};
        if (search) {
            params.query = search;
        } else {
            params.properties = properties;
        }
        
        const method = params.query ? 'post' : 'get';
        const url = params.query ? 'crm/v3/objects/contacts/search' : 'crm/v3/objects/contacts';
        const contacts = await hs.paginatedCall(method, url, params);
     

        return commons.sendArrayOutput({
            context,
            outputPortName: 'out',
            outputType,
            records: contacts
        });
    }
};

const getOutputPortOptions = async (context, outputType) => {

    if (outputType === 'item') {

        const properties = await context.componentStaticCall(
            'appmixer.hubspot.crm.GetContactsProperties',
            'out',
            {
                transform: './GetContactsProperties#contactToSelectArray'
            }
        );

        let output = [
            {
                label: 'Index',
                value: 'index'
            },
            {
                label: 'Contact object',
                value: 'contact'
            }
        ];

        properties.forEach(property => {
            output.push({
                label: property.label,
                value: `contact.${property.value}`
            });
        });

        return context.sendJson(output, 'out');

    } else if (outputType === 'items') {
        return context.sendJson([{ label: 'Contacts', value: 'contacts' }], 'out');
    } else {
        // file
        return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
    }
};
