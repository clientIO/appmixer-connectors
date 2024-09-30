const commons = require('../../shopify-commons');

module.exports = {

    async receive(context) {

        const { xConnectorOutputType } = context.messages.in.content;
        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, xConnectorOutputType);
        }

        const shopify = commons.getShopifyAPI(context.auth);

        const locations = await shopify.location.list();

        await commons.sendArrayOutput({
            context,
            outputType: xConnectorOutputType,
            records: locations
        });
    },

    locationsToSelectArray(locations) {

        return locations.result.map(location => {
            return { label: location.name, value: location.id };
        });
    },

    getOutputPortOptions: function(context, xConnectorOutputType) {

        if (xConnectorOutputType === 'object') {
            return context.sendJson(this.objectOutputOptions, 'out');
        }

        if (xConnectorOutputType === 'array') {
            return context.sendJson(this.arrayOutputOptions, 'out');
        }

        if (xConnectorOutputType === 'file') {
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }

        throw new context.CancelError('Unsupported outputType ' + outputType);

    },

    arrayOutputOptions: [
        {
            label: 'Result',
            value: 'result',
            schema: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: { label: 'Id', value: 'id' },
                        name: { label: 'Name', value: 'name' },
                        address1: { label: 'Address1', value: 'address1' },
                        address2: { label: 'Address2', value: 'address2' },
                        city: { label: 'City', value: 'city' },
                        zip: { label: 'Zip', value: 'zip' },
                        province: { label: 'Province', value: 'province' },
                        country: { label: 'Country', value: 'country' },
                        phone: { label: 'Phone', value: 'phone' },
                        created_at: { label: 'Created At', value: 'created_at' },
                        updated_at: { label: 'Updated At', value: 'updated_at' },
                        country_code: { label: 'Country Code', value: 'country_code' },
                        country_name: { label: 'Country Name', value: 'country_name' },
                        province_code: { label: 'Province Code', value: 'province_code' },
                        legacy: { label: 'Legacy', value: 'legacy' },
                        active: { label: 'Active', value: 'active' },
                        admin_graphql_api_id: { label: 'Admin Graphql Api Id', value: 'admin_graphql_api_id' },
                        localized_country_name: { label: 'Localized Country Name', value: 'localized_country_name' },
                        localized_province_name: { label: 'Localized Province Name', value: 'localized_province_name' }
                    }
                }
            }
        }
    ],

    objectOutputOptions: [
        { label: 'Id', value: 'id' },
        { label: 'Name', value: 'name' },
        { label: 'Address1', value: 'address1' },
        { label: 'Address2', value: 'address2' },
        { label: 'City', value: 'city' },
        { label: 'Zip', value: 'zip' },
        { label: 'Province', value: 'province' },
        { label: 'Country', value: 'country' },
        { label: 'Phone', value: 'phone' },
        { label: 'Created At', value: 'created_at' },
        { label: 'Updated At', value: 'updated_at' },
        { label: 'Country Code', value: 'country_code' },
        { label: 'Country Name', value: 'country_name' },
        { label: 'Province Code', value: 'province_code' },
        { label: 'Legacy', value: 'legacy' },
        { label: 'Active', value: 'active' },
        { label: 'Admin Graphql Api Id', value: 'admin_graphql_api_id' },
        { label: 'Localized Country Name', value: 'localized_country_name' },
        { label: 'Localized Province Name', value: 'localized_province_name' }
    ]
};
