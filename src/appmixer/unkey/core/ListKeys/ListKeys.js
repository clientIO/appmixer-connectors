'use strict';

// Shape of one key in the v2 `apis.listKeys` response (KeyResponseData).
const ITEM_SCHEMA = {
    type: 'object',
    properties: {
        'keyId': { 'type': 'string', 'title': 'Key ID', 'example': 'key_2cGKbMxRyIzhCxo1Idjz8q' },
        'start': { 'type': 'string', 'title': 'Start', 'example': 'acme_3ZK8' },
        'name': { 'type': ['string', 'null'], 'title': 'Name', 'example': 'Production API Key' },
        'enabled': { 'type': 'boolean', 'title': 'Enabled', 'example': true },
        'expires': { 'type': ['integer', 'null'], 'title': 'Expires', 'example': 1789029000000 },
        'createdAt': { 'type': 'integer', 'title': 'Created At', 'example': 1757493000000 },
        'updatedAt': { 'type': ['integer', 'null'], 'title': 'Updated At', 'example': 1757579400000 },
        'meta': { 'type': ['object', 'null'], 'title': 'Metadata', 'example': { 'plan': 'pro' } },
        'credits': {
            'type': ['object', 'null'],
            'title': 'Credits',
            'example': { 'remaining': 1000, 'refill': { 'interval': 'monthly', 'amount': 1000, 'refillDay': 1 } }
        },
        'identity': {
            'type': ['object', 'null'],
            'title': 'Identity',
            'example': { 'id': 'id_4Qm7vT2xLp9sRk3N', 'externalId': 'user_1234', 'meta': { 'tier': 'pro' } }
        }
    }
};
const schema = ITEM_SCHEMA.properties;

module.exports = {
    ITEM_SCHEMA,

    async receive(context) {
        const { apiId, ownerId, outputType } = context.messages.in.content;

        // When the UI requests output port options, respond without requiring inputs
        if (context.properties.generateOutputPortOptions) {
            return getOutputPortOptions(context, outputType);
        }

        if (!apiId) {
            throw new context.CancelError('API ID is required!');
        }

        const allKeys = [];
        let cursor = null;
        const maxRecords = 1000;

        // Fetch all records with pagination
        while (allKeys.length < maxRecords) {
            const params = {
                apiId,
                limit: 100
            };

            // v2 replaced the key owner with the identity's external ID.
            if (ownerId) {
                params.externalId = ownerId;
            }

            if (cursor) {
                params.cursor = cursor;
            }

            const { data } = await context.httpRequest({
                method: 'POST',
                url: 'https://api.unkey.com/v2/apis.listKeys',
                headers: {
                    'Authorization': `Bearer ${context.auth.apiKey}`,
                    'Content-Type': 'application/json'
                },
                data: params
            });

            const keys = data.data || [];
            allKeys.push(...keys);

            // Stop if no more pages or we've reached max records
            if (!data.pagination?.hasMore || allKeys.length >= maxRecords) {
                break;
            }

            cursor = data.pagination.cursor;
        }

        // Trim to max records if needed
        const keys = allKeys.slice(0, maxRecords);

        if (keys.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        if (outputType === 'first') {
            await context.sendJson(
                { ...keys[0], index: 0, count: keys.length },
                'out'
            );
        } else if (outputType === 'object') {
            for (let index = 0; index < keys.length; index++) {
                await context.sendJson(
                    { ...keys[index], index, count: keys.length },
                    'out'
                );
            }
        } else {
            // array is default
            await context.sendJson({ keys, count: keys.length }, 'out');
        }
    }
};

function getOutputPortOptions(context, outputType) {
    if (outputType === 'object' || outputType === 'first') {
        const options = Object.keys(schema)
            .reduce((res, field) => {
                const fieldSchema = schema[field];
                const { title: label, ...schemaWithoutTitle } = fieldSchema;
                res.push({ label, value: field, schema: schemaWithoutTitle });
                return res;
            }, [{
                label: 'Current Item Index',
                value: 'index',
                schema: { type: 'integer' }
            }, {
                label: 'Items Count',
                value: 'count',
                schema: { type: 'integer' }
            }]);
        return context.sendJson(options, 'out');
    }

    if (outputType === 'array') {
        return context.sendJson([{
            label: 'Keys',
            value: 'keys',
            schema: {
                type: 'array',
                items: { type: 'object', properties: schema }
            }
        }, {
            label: 'Count',
            value: 'count',
            schema: { type: 'integer' }
        }], 'out');
    }
}
