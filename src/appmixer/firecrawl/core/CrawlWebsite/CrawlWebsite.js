'use strict';

const lib = require('../../lib');

// Firecrawl's crawl.completed payload carries an empty `data` array - the pages are
// fetched from the status endpoint once the callback says the job is done.
const COMPLETION_EVENTS = ['crawl.completed', 'crawl.failed'];

/**
 * State key holding the inputs of one submitted crawl.
 * @param {string} jobId
 * @returns {string}
 */
const jobKey = (jobId) => `job-${jobId}`;

module.exports = {

    async receive(context) {

        // ── Firecrawl calling back ─────────────────────────────────────────────
        if (context.messages.webhook) {

            const body = (context.messages.webhook.content || {}).data || {};
            const jobId = body.id;

            // `crawl.started` and `crawl.page` are not subscribed to, but acknowledge
            // anything else that arrives instead of failing the delivery.
            if (!jobId || !COMPLETION_EVENTS.includes(body.type)) {
                return context.response();
            }

            // The submit branch stashed this crawl's inputs under its id. Replaying
            // them is what lets a downstream component tell parallel crawls apart:
            // one component instance has one callback URL, and callbacks arrive in
            // completion order, not in the order the crawls were started.
            const submitted = (await context.stateGet(jobKey(jobId))) || {};

            if (body.success === false || body.type === 'crawl.failed') {
                await context.sendJson({
                    ...submitted,
                    jobId,
                    status: 'failed',
                    total: 0,
                    completed: 0,
                    creditsUsed: 0,
                    truncated: false,
                    error: body.error || 'The Firecrawl crawl failed.',
                    data: []
                }, 'done');
            } else {
                const job = await lib.getCrawlJob(context, jobId);

                await context.sendJson({
                    ...submitted,
                    jobId,
                    status: job && job.status,
                    total: job && job.total,
                    completed: job && job.completed,
                    creditsUsed: job && job.creditsUsed,
                    truncated: Boolean(job && job.truncated),
                    error: '',
                    data: (job.data || []).map(lib.toPageOutput)
                }, 'done');
            }

            await context.stateUnset(jobKey(jobId));

            // Acknowledge, or Firecrawl keeps retrying the callback.
            return context.response();
        }

        // ── the submit ─────────────────────────────────────────────────────────
        const {
            url,
            maxPages,
            maxDiscoveryDepth,
            includePaths,
            excludePaths,
            crawlEntireDomain,
            allowSubdomains,
            onlyMainContent,
            correlationId
        } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('URL is required!');
        }

        const scrapeOptions = { formats: ['markdown'] };
        // The API defaults to true; only send the flag when the user turned it off.
        if (lib.isOff(onlyMainContent)) {
            scrapeOptions.onlyMainContent = false;
        }

        const payload = {
            url,
            limit: Number(maxPages) > 0 ? Number(maxPages) : 100,
            scrapeOptions,
            // Firecrawl reports back instead of us polling: the result lands in seconds
            // rather than at the next continuation, which cannot be scheduled under a
            // minute. Only the terminal events are subscribed to - crawl.page would fire
            // once per crawled page.
            webhook: {
                url: context.getWebhookUrl(),
                events: ['completed', 'failed']
            }
        };

        if (Number(maxDiscoveryDepth) > 0) {
            payload.maxDiscoveryDepth = Number(maxDiscoveryDepth);
        }
        const include = lib.parseList(includePaths);
        if (include.length) {
            payload.includePaths = include;
        }
        const exclude = lib.parseList(excludePaths);
        if (exclude.length) {
            payload.excludePaths = exclude;
        }
        if (lib.isOn(crawlEntireDomain)) {
            payload.crawlEntireDomain = true;
        }
        if (lib.isOn(allowSubdomains)) {
            payload.allowSubdomains = true;
        }

        const created = await lib.makeRequest({
            context,
            method: 'POST',
            path: '/v2/crawl',
            data: payload
        });

        const jobId = created && created.id;
        if (!jobId) {
            throw new context.CancelError('Firecrawl did not return a crawl job id.');
        }

        const echo = { url, correlationId };
        await context.stateSet(jobKey(jobId), echo);

        return context.sendJson({ ...echo, jobId, status: 'scraping' }, 'out');
    }
};
