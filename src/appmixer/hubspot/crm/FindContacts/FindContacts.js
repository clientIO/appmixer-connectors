const Hubspot = require('../../Hubspot');
const commons = require('../../commons');

// https://developers.hubspot.com/docs/api/crm/contacts#endpoint?spec=GET-/crm/v3/objects/contacts

module.exports = {

    async receive(context) {

        const { outputType, limit = 100, search } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return getOutputPortOptions(context, outputType);
        }

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        let params = {};
        if (search) {
            params.query = search;
        }

        const url = 'crm/v3/objects/contacts/search';
        const contacts = await hs.paginatedCall('post', url, params, limit);

        if (contacts.length === 0) {
            return context.sendJson({ query: search }, 'notFound');
        }

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
