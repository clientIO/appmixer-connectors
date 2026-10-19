'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { jobId } = context.messages.in.content;

        if (!jobId) {
            throw new context.CancelError('Job ID is required!');
        }

        const job = await lib.getCrawlJob(context, jobId);

        return context.sendJson({
            jobId,
            status: job && job.status,
            total: job && job.total,
            completed: job && job.completed,
            creditsUsed: job && job.creditsUsed,
            truncated: Boolean(job && job.truncated),
            data: (job.data || []).map(lib.toPageOutput)
        }, 'out');
    }
};
