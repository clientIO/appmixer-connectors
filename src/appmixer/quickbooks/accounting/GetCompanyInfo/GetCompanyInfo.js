'use strict';
const { makeRequest } = require('../../commons');

/**
 * Component for making API requests.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { minorVersion } = context.messages.in.content;

        const options = {
            path: `v3/company/${context.profileInfo.companyId}/companyinfo/${context.profileInfo.companyId}?minorversion=${minorVersion}`,
            method: 'GET'
        };
        const response = await makeRequest({ context, options });

        return context.sendJson(response.data?.CompanyInfo, 'out');
    }
};
