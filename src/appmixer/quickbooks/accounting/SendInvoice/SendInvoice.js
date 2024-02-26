'use strict';

const { makeRequest } = require('../../commons');

module.exports = {

    async receive(context) {

        const { invoiceId } = context.messages.in.content;

        const options = {
            path: `v3/company/${context.profileInfo.companyId}/invoice/${invoiceId}/send`,
            method: 'POST',
            data: null
        };

        context.log({ step: 'Making request', options });
        const { data } = await makeRequest({ context, options });
        return context.sendJson(data?.Invoice, 'out');
    }
};
