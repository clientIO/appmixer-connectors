'use strict';
const ZohoClient = require('../../ZohoClient');
const lib = require('../lib');

const DISPLAY_FIELD_TYPE_AUTONUMBER = 'autonumber';

/**
 * @param {string|Array<string>} profileIds Comma separated list or an array of profile IDs.
 * @returns {Array<string>}
 */
function parseIds(profileIds) {

    const ids = Array.isArray(profileIds) ? profileIds : String(profileIds || '').split(',');
    return ids.map(id => String(id).trim()).filter(Boolean);
}

/**
 * Create a custom module. Zoho accepts one module per call and answers with the new module's ID
 * only, so the module metadata is read back for the output.
 */
module.exports = {

    async receive(context) {

        const {
            singularLabel,
            pluralLabel,
            apiName,
            profileIds,
            displayFieldLabel,
            displayFieldType,
            autoNumberStart,
            autoNumberPrefix,
            autoNumberSuffix
        } = context.messages.in.content;

        if (!singularLabel) {
            throw new context.CancelError('Singular Label is required!');
        }
        if (!pluralLabel) {
            throw new context.CancelError('Plural Label is required!');
        }

        const client = new ZohoClient(context, undefined, { apiVersion: lib.MODULES_API_VERSION });

        // Zoho requires at least one profile with access to the module. Without an explicit list
        // the module is opened to every profile, which is what the Zoho CRM setup UI preselects.
        let profiles = parseIds(profileIds);
        if (!profiles.length) {
            const response = await client.request('GET', client.path('/settings/profiles'));
            profiles = (response?.profiles || []).map(profile => profile.id);
        }
        if (!profiles.length) {
            throw new context.CancelError('No profile to grant the module to. Provide Profile IDs.');
        }

        const module = {
            singular_label: singularLabel,
            plural_label: pluralLabel,
            profiles: profiles.map(id => ({ id }))
        };
        if (apiName) {
            module.api_name = apiName;
        }
        if (displayFieldLabel) {
            module.display_field = {
                field_label: displayFieldLabel,
                data_type: displayFieldType || 'text'
            };
            if (module.display_field.data_type === DISPLAY_FIELD_TYPE_AUTONUMBER) {
                module.display_field.auto_number = { start_number: Number(autoNumberStart) || 1 };
                if (autoNumberPrefix) {
                    module.display_field.auto_number.prefix = autoNumberPrefix;
                }
                if (autoNumberSuffix) {
                    module.display_field.auto_number.suffix = autoNumberSuffix;
                }
            }
        }

        const { details } = await client.executeBulkRequest('POST', client.path('/settings/modules'), 'modules', {
            data: { modules: [module] }
        });

        const created = (await lib.getModules(client)).find(item => item.id === details.id);

        return context.sendJson(created || {
            id: details.id,
            api_name: apiName,
            singular_label: singularLabel,
            plural_label: pluralLabel
        }, 'out');
    }
};
