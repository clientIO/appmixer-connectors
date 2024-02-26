'use strict';
const { makeRequest } = require('../../commons');

module.exports = {

    async receive(context) {

        const {
            billId,
            minorVersion
        } = context.messages.in.content;

        const options = {
            path: `v3/company/${context.profileInfo.companyId}/bill/${billId}?minorversion=${minorVersion}`,
            method: 'GET'
        };
        const response = await makeRequest({ context, options });
        return context.sendJson(response.data?.Bill, 'out');
    }
};
