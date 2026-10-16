'use strict';

const lib = require('../../lib');

// The tasks API has no cursor; it caps a single page at 1000 records.
const PAGE_SIZE = 1000;

const ITEM_SCHEMA = {
    type: 'object',
    required: ['taskId', 'status'],
    properties: {
        taskId: { type: 'string', title: 'Task ID', example: '6a95493889a78ab01364b817' },
        title: { type: 'string', title: 'Title', example: 'Approve Q3 budget' },
        description: { type: 'string', title: 'Description', example: 'Please review the attached budget proposal.' },
        status: { type: 'string', title: 'Status', example: 'pending' },
        requester: { type: 'string', title: 'Requester', example: 'U0ABC12345' },
        approver: { type: 'string', title: 'Approver', example: 'U0DEF67890' },
        channel: { type: 'string', title: 'Channel', example: 'D0ABC12345' },
        decisionBy: { type: 'string', title: 'Decision By', example: '2026-09-30T12:00:00.000Z' },
        decisionByReadable: { type: 'string', title: 'Decision By (Human Readable)', example: '9/30/2026, 12:00:00 PM' },
        decisionMade: { type: 'string', title: 'Decision Made', example: '2026-09-25T09:15:00.000Z' },
        actor: { type: 'string', title: 'Actor', example: 'U0DEF67890' },
        created: { type: 'string', title: 'Created', example: '2026-09-23T08:00:00.000Z' }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const {
            outputType = 'array',
            status,
            title,
            requester,
            approver
        } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Tasks' });
        }

        // Build query parameters
        const queryParams = new URLSearchParams();

        if (status && status !== 'all') {
            queryParams.append('status', status);
        }

        if (title) {
            queryParams.append('title', title);
        }

        if (requester) {
            queryParams.append('requester', requester);
        }

        if (approver) {
            queryParams.append('approver', approver);
        }

        queryParams.append('limit', String(PAGE_SIZE));

        // Make HTTP request to the tasks API
        const response = await context.callAppmixer({
            method: 'GET',
            endPoint: `/plugins/appmixer/slack/tasks?${queryParams.toString()}`,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Transform tasks to include human-readable date
        const records = (response || []).map(task => {
            // Add human-readable decision by date
            if (task.decisionBy) {
                const decisionByDate = new Date(task.decisionBy);
                task.decisionByReadable = decisionByDate.toLocaleString();
            }

            return task;
        });

        if (records.length === 0) {
            return context.sendJson({ status, title, requester, approver }, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputPortName: 'out', outputType, records });
    }
};
