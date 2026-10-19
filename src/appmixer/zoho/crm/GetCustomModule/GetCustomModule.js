'use strict';
const ZohoClient = require('../../ZohoClient');
const lib = require('../lib');

/**
 * Get the metadata of a single module by its API name.
 */
module.exports = {

    async receive(context) {

        const { moduleApiName } = context.messages.in.content;

        if (!moduleApiName) {
            throw new context.CancelError('Module API Name is required!');
        }

        const client = new ZohoClient(context, undefined, { apiVersion: lib.MODULES_API_VERSION });
        const response = await client.request(
            'GET',
            client.path(`/settings/modules/${encodeURIComponent(moduleApiName)}`)
        );
        const module = Array.isArray(response?.modules) ? response.modules[0] : null;

        if (!module) {
            throw new context.CancelError(`Module ${moduleApiName} was not found.`);
        }

        return context.sendJson(module, 'out');
    }
};
