const assert = require('assert');

describe('CreateInvoice', function() {

    const context = {
        componentId: 'mock',
        flowDescriptor: { 'mock': { label: 'label' } },
        profileInfo: { companyId: 'companyId' },
        config: {},
        log: console.log,
        messages: { in: { content: {} } },
        CancelError: Error
    };

    it('should fail with no line items', async function() {

        const action = require('../../../../src/appmixer/quickbooks/accounting/CreateInvoice/CreateInvoice');

        await assert.rejects(
            async () => {
                await action.receive(context);
            },
            context.CancelError('Invalid JSON in "Line Items JSON"')
        );
    });
});
