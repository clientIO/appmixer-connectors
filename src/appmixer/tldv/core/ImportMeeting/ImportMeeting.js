'use strict';

const lib = require('../../lib');

// Appmixer rounds any context.setTimeout delay below one minute up to one minute,
// and does it silently, so one minute is both the floor and the only sensible
// poll interval here.
const MIN_POLL_INTERVAL_MS = 60 * 1000;
const DEFAULT_POLLING_TIMEOUT_SECONDS = 300;

// tl;dv exposes no job-status endpoint for imports (GET /meetings/import/{jobId}
// and the obvious variants all 404), but the created meeting carries the import's
// job id verbatim in `extraProperties.conferenceId`, and that is how a submitted
// import is resolved to its meeting. The list endpoint ignores unknown query
// params (a `conferenceId` filter returns everything), so matching is client-side.
async function findMeetingByJobId(context, jobId) {

    let page = 1;
    let pages = 1;
    let seen = 0;

    do {
        const data = await lib.fetchMeetingsPage(context, { page, limit: lib.MAX_PAGE_SIZE });
        const batch = Array.isArray(data.results) ? data.results : [];

        const match = batch.find(
            (meeting) => meeting && meeting.extraProperties
                && meeting.extraProperties.conferenceId === jobId
        );
        if (match) {
            return match;
        }

        seen += batch.length;
        pages = Number.isFinite(data.pages) ? data.pages : 1;
        page += 1;
    } while (page <= pages && seen < lib.MAX_RESULTS);

    return null;
}

module.exports = {

    async receive(context) {

        // ── polling continuation scheduled by a previous invocation ────────────
        // context.setTimeout instead of sleeping in-process keeps the worker free;
        // everything the continuation needs travels in the timeout payload, so
        // parallel imports cannot collide over shared state.
        if (context.messages.timeout) {

            const { jobId, correlationId, deadline, pollIntervalMs } = context.messages.timeout.content;

            const meeting = await findMeetingByJobId(context, jobId);
            if (meeting) {
                return context.sendJson({ ...meeting, jobId, correlationId }, 'done');
            }

            if (Date.now() >= deadline) {
                throw new context.CancelError(
                    `tl;dv import ${jobId} did not produce a meeting within the polling timeout. `
                    + 'The import may still be processing - find it later with Find Meetings '
                    + '(the meeting\'s Conference ID equals this job id) or the New Meeting trigger.'
                );
            }

            return context.setTimeout(
                { jobId, correlationId, deadline, pollIntervalMs }, pollIntervalMs);
        }

        // ── the submit ─────────────────────────────────────────────────────────
        const {
            name, url, happenedAt, participants, dryRun, correlationId, pollingTimeout
        } = context.messages.in.content;

        if (!name) {
            throw new context.CancelError('Name is required!');
        }
        if (!url) {
            throw new context.CancelError('URL is required!');
        }

        const body = { name, url };

        if (happenedAt) {
            body.happenedAt = happenedAt;
        }

        // Accept a comma/newline separated list of participant emails.
        if (participants) {
            const emails = String(participants)
                .split(/[\n,]/)
                .map((email) => email.trim())
                .filter(Boolean);
            if (emails.length) {
                body.participants = emails;
            }
        }

        if (dryRun === true || dryRun === 'true') {
            body.dryRun = true;
        }

        const { data } = await lib.apiRequest(context, {
            method: 'POST',
            path: `/${lib.API_VERSION}/meetings/import`,
            data: body
        });

        await context.sendJson({
            success: data && data.success,
            jobId: data && data.jobId,
            message: data && data.message,
            correlationId
        }, 'out');

        // A dry run validates the request without persisting anything, so there is
        // no meeting to wait for and `done` never fires.
        if (body.dryRun) {
            return;
        }

        if (!data || !data.jobId) {
            throw new context.CancelError('tl;dv did not return an import job id.');
        }

        const pollIntervalMs = MIN_POLL_INTERVAL_MS;
        const requestedSeconds = Number(pollingTimeout) > 0
            ? Number(pollingTimeout)
            : DEFAULT_POLLING_TIMEOUT_SECONDS;
        // The first poll cannot happen sooner than one interval from now, so a
        // shorter timeout would spend a minute waiting only to fail on a deadline
        // that had already passed.
        const timeoutMs = Math.max(requestedSeconds * 1000, pollIntervalMs);

        return context.setTimeout({
            jobId: data.jobId,
            correlationId,
            deadline: Date.now() + timeoutMs,
            pollIntervalMs
        }, pollIntervalMs);
    }
};
