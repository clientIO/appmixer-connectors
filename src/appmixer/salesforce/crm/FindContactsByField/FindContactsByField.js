'use strict';
const commons = require('../lib');

/**
 * Get all contacts related to a chosen Contact field value, for example every
 * contact whose Account, Lead Source or a custom field (such as a Campaign ID)
 * matches a given value.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { fieldName, fieldValue, matchType = 'exact', outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return commons.getContactOutputPortOptions(context, outputType);
        }

        if (!fieldName) {
            throw new context.CancelError('Field is required!');
        }
        if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
            throw new context.CancelError('Field value is required!');
        }

        // Reject anything that is not a plain Salesforce API field name so the
        // value cannot be used to inject arbitrary SOQL.
        try {
            commons.assertSafeIdentifier(fieldName, 'field name');
        } catch (err) {
            throw new context.CancelError(err.message);
        }

        let where;
        if (matchType === 'contains' || matchType === 'startsWith') {
            // SOQL LIKE: % matches any sequence of characters. LIKE only works on
            // text fields (Email, LastName, custom text fields, ...) — on ID,
            // number or date fields Salesforce rejects the query, so the Exact
            // match type must be used for those. escapeSoqlLike() escapes the
            // LIKE wildcards in the user value so it is matched literally.
            const escaped = commons.escapeSoqlLike(fieldValue);
            const pattern = matchType === 'contains' ? `%${escaped}%` : `${escaped}%`;
            where = `${fieldName} LIKE '${pattern}'`;
        } else {
            where = `${fieldName} = ${await buildExactLiteral(context, fieldName, fieldValue)}`;
        }
        // Include the filtered field in the SELECT list so its value (e.g. a
        // custom field) is present in the output records.
        const records = await commons.findContacts(context, { where, extraFields: [fieldName] });

        if (!records.length) {
            return context.sendJson({}, 'notFound');
        }

        return commons.sendArrayOutput({
            context,
            outputPortName: 'out',
            outputType,
            records
        });
    }
};

// SOQL literal formats for the non-text field types that must NOT be quoted.
const UNQUOTED_LITERALS = {
    'boolean': /^(true|false)$/i,
    'date': /^\d{4}-\d{2}-\d{2}$/,
    'datetime': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/,
    'int': /^-?\d+$/,
    'long': /^-?\d+$/,
    'double': /^-?\d+(\.\d+)?$/,
    'currency': /^-?\d+(\.\d+)?$/,
    'percent': /^-?\d+(\.\d+)?$/
};

/**
 * Build the right-hand side of the exact-match comparison. SOQL requires
 * boolean, number, date and datetime literals to be UNQUOTED — quoting them
 * fails with MALFORMED_QUERY — so look the field's type up in the (cached)
 * Contact describe and emit an unquoted literal for those types. The literal
 * is validated against a strict format first, which both gives the user a
 * clear error and keeps the unquoted interpolation injection-safe.
 */
async function buildExactLiteral(context, fieldName, fieldValue) {

    let fields;
    try {
        fields = await commons.api.getObjectFields(context, { objectName: 'Contact', cache: true });
    } catch (err) {
        // context.staticCache is unavailable in some runtimes (appmixer CLI) —
        // fall back to a live describe call.
        fields = await commons.api.getObjectFields(context, { objectName: 'Contact', cache: false });
    }

    const fieldMeta = (fields || []).find(field => field.name === fieldName);
    const literalFormat = fieldMeta && UNQUOTED_LITERALS[fieldMeta.type];
    if (literalFormat) {
        const value = String(fieldValue).trim();
        if (!literalFormat.test(value)) {
            throw new context.CancelError(
                `Invalid value "${fieldValue}" for the ${fieldMeta.type} field ${fieldName}. ` +
                'Expected a plain literal, for example: true, 42, 2026-08-18 or 2026-08-18T09:30:00Z.');
        }
        return value;
    }
    return `'${commons.escapeSoql(fieldValue)}'`;
}
