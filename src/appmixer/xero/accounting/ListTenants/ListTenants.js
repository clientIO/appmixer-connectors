'use strict';
const { sendArrayOutput, withCache } = require('../../commons');

const outputPortName = 'tenants';

module.exports = {

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

        if (outputType === 'item') {
            return context.sendJson(
                [
                    { label: 'id', value: 'id' },
                    { label: 'authEventId', value: 'authEventId' },
                    { label: 'tenantId', value: 'tenantId' },
                    { label: 'tenantType', value: 'tenantType' },
                    { label: 'tenantName', value: 'tenantName' },
                    { label: 'createdDateUtc', value: 'createdDateUtc' },
                    { label: 'updatedDateUtc', value: 'updatedDateUtc' }
                ],
                outputPortName
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Tenants',
                        value: 'items',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', title: 'id' },
                                    authEventId: { type: 'string', title: 'authEventId' },
                                    tenantId: { type: 'string', title: 'tenantId' },
                                    tenantType: { type: 'string', title: 'tenantType' },
                                    tenantName: { type: 'string', title: 'tenantName' },
                                    createdDateUtc: { type: 'string', title: 'createdDateUtc' },
                                    updatedDateUtc: { type: 'string', title: 'updatedDateUtc' }
                                }
                            }
                        }
                    }
                ],
                outputPortName
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], outputPortName);
        }
    }
};
