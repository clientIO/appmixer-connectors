'use strict';

const mime = require('mime-types');

// The subdomain is the only part of the request host that comes from user input, and the client
// secret and access token are sent to that host - so anything but a plain Zendesk subdomain is rejected.
// It is checked as typed, without normalizing: the components build their URLs from the stored value.
const SUBDOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;

/**
 * @param {string} subdomain - e.g. "example" for example.zendesk.com
 * @return {string} https origin of the Zendesk account
 * @throws Error
 */
const zendeskOrigin = function(subdomain) {

    if (typeof subdomain !== 'string' || !SUBDOMAIN_PATTERN.test(subdomain)) {
        throw new Error('Invalid Zendesk subdomain. Enter the subdomain only, e.g. "example" for example.zendesk.com.');
    }
    return `https://${subdomain}.zendesk.com`;
};

module.exports = {

    zendeskOrigin,

    /**
     * Normalize multiselect input (array or string) to array format.
     * Strings are treated as single values or comma-separated lists.
     * @param {string|string[]} input
     * @param {object} context
     * @param {string} fieldName
     * @returns {string[]}
     */
    normalizeMultiselectInput(input, context, fieldName) {

        if (Array.isArray(input)) {
            return input;
        } else if (typeof input === 'string') {
            // Handle single string value or comma-separated string
            return input.split(',').map(item => item.trim()).filter(item => item.length > 0);
        } else {
            throw new context.CancelError(`${fieldName} must be a string or an array`);
        }
    },

    uploadFile: async function(context, fileId) {

        const fileStream = await context.getFileReadStream(fileId);
        const fileInfo = await context.getFileInfo(fileId);
        const url = `${zendeskOrigin(context.auth.subdomain)}/api/v2/uploads.json?filename=${fileInfo.filename}`;
        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken,
            'Content-Type': mime.lookup(fileInfo.filename) || 'application/octet-stream'
        };
        const req = {
            url: url,
            method: 'POST',
            data: fileStream,
            headers: headers
        };
        return context.httpRequest(req);
    }
};
