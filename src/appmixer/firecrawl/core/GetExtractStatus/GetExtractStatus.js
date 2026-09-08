'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { jobId } = context.messages.in.content;

        if (!jobId) {
            throw new context.CancelError('Job ID is required!');
        }

        const job = await lib.makeRequest({
            context,
            method: 'GET',
            path: `/v2/extract/${jobId}`
        });

        return context.sendJson({
            jobId,
            status: job && job.status,
            data: job && job.data,
            tokensUsed: job && job.tokensUsed,
            expiresAt: job && job.expiresAt
        }, 'out');
    }
};
