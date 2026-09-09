'use strict';

const { makeRequest } = require('../commons');
const { sendArrayOutput } = require('../../microsoft-commons');

// The output contract of ONE attachment record. Exported so the offline tooling
// (appmixer connector verify, the outport validators) can read the shape a
// dynamic out port would otherwise hide.
//
// These are metadata-only fields of the base attachment resource. Selecting only
// these guarantees the binary `contentBytes` (a fileAttachment-specific property)
// is never returned, which avoids Appmixer's max message size exception on emails
// with large attachments. Use the DownloadAttachment component to get content.
const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'name', 'contentType', 'size', 'isInline', 'lastModifiedDateTime'],
    properties: {
        id: { type: 'string', title: 'Attachment ID', example: 'AAMkAGI2...=' },
        name: { type: 'string', title: 'Name', example: 'invoice.pdf' },
        contentType: { type: 'string', title: 'Content Type', example: 'application/pdf' },
        size: { type: 'integer', title: 'Size', example: 48213 },
        isInline: { type: 'boolean', title: 'Is Inline', example: false },
        lastModifiedDateTime: {
            type: 'string',
            title: 'Last Modified Date Time',
            example: '2026-09-09T08:15:30Z'
        }
    }
};

// Derived from the schema so the $select projection and the declared output
// contract cannot drift apart.
const METADATA_FIELDS = Object.keys(ITEM_SCHEMA.properties);

/**
 * Out-port variable-picker options for the selected outputType. Matches what
 * microsoft-commons.sendArrayOutput emits: array -> { result, count },
 * object -> the record fields plus index/count.
 * @param {string} outputType
 * @return {Array<Object>}
 */
function buildOutputPortOptions(outputType) {

    if (outputType === 'attachments') {
        // All at once: a single "Result" array of attachment records.
        return [{
            label: 'Result',
            value: 'result',
            schema: { type: 'array', items: ITEM_SCHEMA }
        }, {
            label: 'Items Count',
            value: 'count',
            schema: { type: 'integer' }
        }];
    }

    // One at a time: the record fields, plus the position of this record in the run.
    const fields = METADATA_FIELDS.map(key => {
        const { title, ...schema } = ITEM_SCHEMA.properties[key];
        return { label: title, value: key, schema };
    });

    return fields.concat([{
        label: 'Current Item Index',
        value: 'index',
        schema: { type: 'integer' }
    }, {
        label: 'Items Count',
        value: 'count',
        schema: { type: 'integer' }
    }]);
}

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return context.sendJson(
                buildOutputPortOptions(context.messages.in.content.outputType),
                'out'
            );
        }

        const { messageId, outputType } = context.messages.in.content;

        if (!messageId) {
            throw new context.CancelError('Message ID is required!');
        }

        const url = `/me/messages/${messageId}/attachments`;
        const attachmentsResponse = await makeRequest(context, {
            path: url,
            method: 'GET',
            params: { '$select': METADATA_FIELDS.join(',') }
        });

        const records = attachmentsResponse.data.value || [];

        // The inspector keeps its original enum values ('attachment'/'attachments')
        // because saved flows carry those literals; map them onto the standardized
        // modes sendArrayOutput expects.
        const mode = outputType === 'attachments' ? 'array' : 'object';

        return sendArrayOutput({ context, outputType: mode, records });
    }
};
