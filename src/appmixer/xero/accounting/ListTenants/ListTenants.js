'use strict';
const { sendArrayOutput, withCache, getOutputPortOptions } = require('../../commons');

const outputPortName = 'tenants';

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'tenantId', 'tenantType', 'tenantName'],
    properties: {
        id: { type: 'string', title: 'id', example: '5c7bd0d0-1c4b-4a2c-9f3e-8d1a6b4c2e70' },
        authEventId: { type: 'string', title: 'authEventId', example: '9a1b2c3d-4e5f-4061-8273-5a6b7c8d9e01' },
        tenantId: { type: 'string', title: 'tenantId', example: 'f4d93dc2-0a17-4b6e-9c58-3e1d7a0b2c94' },
        tenantType: { type: 'string', title: 'tenantType', example: 'ORGANISATION' },
        tenantName: { type: 'string', title: 'tenantName', example: 'Appmixer test 2026' },
        createdDateUtc: { type: 'string', title: 'createdDateUtc', example: '2026-01-14T08:12:44.1470000' },
        updatedDateUtc: { type: 'string', title: 'updatedDateUtc', example: '2026-03-18T09:24:31.1230000' }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        // Cache the tenant list: ListTenants backs the Tenant ID dropdown of ~20 components, so every
        // inspector open of any Xero component fires this. See commons.withCache for details.
        const records = await withCache(context, { url: '/connections' }, async () => {
            const tenants = await context.httpRequest({
                url: 'https://api.xero.com/connections',
                method: 'GET',
                headers: {
                    authorization: `Bearer ${context.accessToken || context.auth?.accessToken}`,
                    accept: 'application/json'
                }
            });
            return tenants.data;
        });

        return sendArrayOutput({
            context,
            outputPortName,
            outputType,
            records
        });
    },

    getOutputPortOptions(context, outputType) {

        return getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, {
            label: 'Tenants',
            outputPortName
        });
    }
};
