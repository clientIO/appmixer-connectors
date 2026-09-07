'use strict';

const lib = require('../../lib');

// Public E2B templates that are always available but are not returned
// by the team-scoped GET /templates endpoint.
const PUBLIC_TEMPLATES = [
    { label: 'base', value: 'base' },
    { label: 'code-interpreter-v1', value: 'code-interpreter-v1' }
];

// Schema of a single template item.
const schema = {
    templateID: { type: 'string', title: 'Template ID', example: 'rki5dems9wqfm4r03t7g' },
    buildID: { type: 'string', title: 'Build ID', example: 'f2b6c1d0-9c1e-4b8a-8b6a-2f0f4d1f4e2a' },
    names: {
        type: 'array',
        title: 'Names',
        items: { type: 'string' },
        example: ['my-template']
    },
    cpuCount: { type: 'integer', title: 'CPU Count', example: 2 },
    memoryMB: { type: 'integer', title: 'Memory (MB)', example: 512 },
    diskSizeMB: { type: 'integer', title: 'Disk Size (MB)', example: 1024 },
    public: { type: 'boolean', title: 'Public', example: false },
    createdAt: { type: 'string', title: 'Created At', example: '2026-07-09T10:30:00.000Z' },
    updatedAt: { type: 'string', title: 'Updated At', example: '2026-07-09T10:30:00.000Z' }
};

module.exports = {

    async receive(context) {

        const { outputType = 'array' } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Templates' });
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${lib.BASE_URL}/templates`,
            headers: lib.authHeaders(context)
        });

        const records = Array.isArray(data) ? data : (data.templates || []);

        return lib.sendArrayOutput({ context, records, outputType });
    },

    toSelectArray(msg) {

        const items = msg.result || (Array.isArray(msg) ? msg : []);
        const custom = items.map(template => {
            const name = (template.names && template.names[0])
                || (template.aliases && template.aliases[0])
                || template.templateID;
            return { label: name, value: template.templateID };
        });
        return PUBLIC_TEMPLATES.concat(custom);
    }
};
