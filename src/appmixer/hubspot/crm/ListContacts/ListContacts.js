'use strict';
const Hubspot = require('../../Hubspot');
const commons = require('../../commons');

// https://developers.hubspot.com/docs/api/crm/contacts#endpoint?spec=GET-/crm/v3/objects/contacts

module.exports = {
    async receive(context) {

        const {
            outputType,
            properties,
            limit = 100
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return getOutputPortOptions(context, outputType);
        }

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        let params = {};

        if (properties) {
            params.properties = properties;
        }

        const url = 'crm/v3/objects/contacts';
        const contacts = await hs.paginatedCall('get', url, params, limit);

        return commons.sendArrayOutput({
            context,
            outputPortName: 'out',
            outputType,
            records: contacts
        });
    }
};

const getOutputPortOptions = async (context, outputType) => {

    if (outputType === 'object') {

        const properties = await context.componentStaticCall(
            'appmixer.hubspot.crm.GetContactsProperties',
            'out',
            {
                transform: './transformers#contactToSelectArray'
            }
        );

        return context.sendJson(properties, 'out');

    } else if (outputType === 'array') {

        const schema = await context.componentStaticCall(
            'appmixer.hubspot.crm.GetContactsProperties',
            'out',
            {
                transform: './transformers#contactsToSchema'
            }
        );

        return context.sendJson([{ label: 'Array', value: 'array', schema }], 'out');

    } else {
        // file
        return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
    }
};
