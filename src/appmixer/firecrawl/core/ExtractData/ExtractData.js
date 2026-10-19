'use strict';

const lib = require('../../lib');

// Appmixer will not schedule a continuation shorter than one minute, so that is
// both the default and the floor for the polling interval.
const MIN_POLL_INTERVAL_SECONDS = 60;

module.exports = {

    async receive(context) {

        // Polling continuation scheduled by a previous invocation. Doing this
        // with context.setTimeout instead of sleeping in-process keeps the
        // worker free and survives the engine's cap on a single execution.
        if (context.messages.timeout) {

            const { jobId, deadline, pollIntervalMs } = context.messages.timeout.content;

            const job = await lib.makeRequest({
                context,
                method: 'GET',
                path: `/v2/extract/${jobId}`
            });

            if (job && job.status === 'completed') {
                return context.sendJson({
                    jobId,
                    status: job.status,
                    data: job.data,
                    tokensUsed: job.tokensUsed
                }, 'out');
            }

            if (job && (job.status === 'failed' || job.status === 'cancelled')) {
                throw new context.CancelError(`Firecrawl extraction ${jobId} ${job.status}.`);
            }

            if (Date.now() >= deadline) {
                const status = (job && job.status) || 'unknown';
                throw new context.CancelError(
                    `Extraction ${jobId} did not complete in time (status: ${status}). `
                    + 'Use the Get Extract Status component with this job id to fetch the result once it is done.'
                );
            }

            return context.setTimeout({ jobId, deadline, pollIntervalMs }, pollIntervalMs);
        }

        const {
            urls,
            prompt,
            schema,
            enableWebSearch,
            wait,
            pollingTimeout
        } = context.messages.in.content;

        const urlList = lib.parseList(urls);
        if (!urlList.length) {
            throw new context.CancelError('URLs is required!');
        }
        if (!prompt && !schema) {
            throw new context.CancelError('Either Prompt or JSON Schema is required!');
        }

        const payload = { urls: urlList };

        if (prompt) {
            payload.prompt = prompt;
        }
        if (schema) {
            if (typeof schema === 'object') {
                payload.schema = schema;
            } else {
                try {
                    payload.schema = JSON.parse(schema);
                } catch (error) {
                    throw new context.CancelError('JSON Schema must be valid JSON.');
                }
            }
        }
        if (enableWebSearch === true || enableWebSearch === 'true') {
            payload.enableWebSearch = true;
        }

        const created = await lib.makeRequest({
            context,
            method: 'POST',
            path: '/v2/extract',
            data: payload
        });

        const jobId = created && created.id;
        if (!jobId) {
            throw new context.CancelError('Firecrawl did not return an extraction job id.');
        }

        // When the user opts out of waiting, return the created job reference
        // and let Get Extract Status fetch the result later.
        if (wait === false || wait === 'false') {
            return context.sendJson({ jobId, status: 'processing' }, 'out');
        }

        const timeoutSeconds = Number(pollingTimeout) > 0 ? Number(pollingTimeout) : 600;
        const pollIntervalSeconds = Math.max(
            Number(context.config && context.config.pollIntervalSeconds) || MIN_POLL_INTERVAL_SECONDS,
            MIN_POLL_INTERVAL_SECONDS
        );

        return context.setTimeout({
            jobId,
            deadline: Date.now() + timeoutSeconds * 1000,
            pollIntervalMs: pollIntervalSeconds * 1000
        }, pollIntervalSeconds * 1000);
    }
};
