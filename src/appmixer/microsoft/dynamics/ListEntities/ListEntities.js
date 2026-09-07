'use strict';

const { sendArrayOutput } = require('../../microsoft-commons');

// Fixed output-record shape for this component (entity definitions). Used to build
// the variable-picker options per outputType (array / object / file), mirroring the
// dynamic List/Find components — except the shape here is known up front, so no API
// call is needed to produce the options.
const FIELDS = [
    { key: 'logicalName', title: 'Logical Name', type: 'string', example: 'account' },
    { key: 'displayName', title: 'Display Name', type: 'string', example: 'Account' },
    { key: 'entitySetName', title: 'Entity Set Name', type: 'string', example: 'accounts' },
    { key: 'primaryIdAttribute', title: 'Primary ID Attribute', type: 'string', example: 'accountid' },
    { key: 'primaryNameAttribute', title: 'Primary Name Attribute', type: 'string', example: 'name' },
    { key: 'isCustomEntity', title: 'Is Custom Entity', type: 'boolean', example: false }
];

// Build the out-port variable-picker options for the selected outputType. Matches what
// microsoft-commons.sendArrayOutput emits: array -> { result }, object/first -> the
// record fields, file -> { fileId }.
function buildOutputPortOptions(outputType) {

    if (outputType === 'file') {
        return [{ label: 'File ID', value: 'fileId' }];
    }

    if (outputType === 'object' || outputType === 'first') {
        return FIELDS.map(field => ({ label: `${field.title} (${field.key})`, value: field.key }));
    }

    // array (default): a single "Result" array of records.
    const properties = FIELDS.reduce((acc, field) => {
        acc[field.key] = { type: field.type, title: field.title, example: field.example };
        return acc;
    }, {});

    return [{
        label: 'Result',
        value: 'result',
        schema: { type: 'array', items: { type: 'object', properties } }
    }];
}

module.exports = {

    async receive(context) {

        // Out-port variable-picker options. No API call / auth needed — the shape is fixed.
        if (context.properties.generateOutputPortOptions) {
            const { outputType = 'array' } = context.messages.in.content;
            return context.sendJson(buildOutputPortOptions(outputType), 'out');
        }

        const { userFacingOnly = true, outputType } = context.messages.in.content;

        const resource = context.resource || context.auth.resource;
        const url = `${resource}/api/data/v9.2/EntityDefinitions`
            + '?$select=LogicalName,DisplayName,EntitySetName,PrimaryIdAttribute,'
            + 'PrimaryNameAttribute,IsCustomEntity,IsIntersect,IsPrivate,IsLogicalEntity';

        const options = {
            url,
            headers: {
                Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
                accept: 'application/json'
            }
        };

        const { data } = await context.httpRequest(options);

        let entities = data.value;

        if (userFacingOnly) {
            // Keep only entities a user would normally work with: drop M:N join tables (IsIntersect),
            // internal entities (IsPrivate), virtual/logical entities (IsLogicalEntity) and entities
            // without a friendly display name (those are system/internal).
            entities = entities.filter(item =>
                !item.IsIntersect
                && !item.IsPrivate
                && !item.IsLogicalEntity
                && item.DisplayName?.UserLocalizedLabel?.Label);
        }

        const records = entities
            .map(item => ({
                logicalName: item.LogicalName,
                displayName: item.DisplayName?.UserLocalizedLabel?.Label || item.LogicalName,
                entitySetName: item.EntitySetName,
                primaryIdAttribute: item.PrimaryIdAttribute,
                primaryNameAttribute: item.PrimaryNameAttribute,
                isCustomEntity: item.IsCustomEntity
            }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));

        if (records.length === 0) {
            return context.sendJson({ message: 'No entities returned.' }, 'emptyResult');
        }

        return sendArrayOutput({ context, outputType, records });
    }
};
