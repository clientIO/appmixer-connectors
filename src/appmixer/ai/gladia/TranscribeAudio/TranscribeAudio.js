'use strict';

const lib = require('../lib');

// Appmixer rounds any context.setTimeout delay below one minute up to one
// minute, and does it silently, so one minute is both the floor and the only
// sensible poll interval here. Every duration below is derived from it.
const MIN_POLL_INTERVAL_SECONDS = 60;

function parseCsv(value) {
    if (!value) {
        return [];
    }
    return String(value)
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

/**
 * Build a human readable reason for a failed Gladia job. Current API responses
 * carry `error_message`; older ones only had `error_code`/`error`, so all three
 * are consulted before falling back to a generic message.
 * @param {object} job the Gladia job payload
 * @returns {string}
 */
function describeJobError(job) {

    const parts = [job && job.error_message, job && job.error_code, job && job.error]
        .filter(Boolean)
        .map(part => (typeof part === 'string' ? part : JSON.stringify(part)));

    return parts.length ? parts.join(' - ') : 'unknown error';
}

module.exports = {
    async receive(context) {

        // Polling continuation scheduled by a previous invocation. Doing this with
        // context.setTimeout instead of sleeping in-process keeps the worker free
        // and survives the engine's cap on a single execution.
        if (context.messages.timeout) {

            const { jobId, deadline, pollIntervalMs } = context.messages.timeout.content;

            const job = await lib.makeRequest({
                context,
                method: 'GET',
                path: `/v2/transcription/${jobId}`
            });

            if (job && job.status === 'done') {
                return context.sendJson(job, 'out');
            }

            if (job && job.status === 'error') {
                throw new context.CancelError(
                    `Gladia transcription ${jobId} failed: ${describeJobError(job)}`
                );
            }

            if (Date.now() >= deadline) {
                const status = (job && job.status) || 'unknown';
                throw new context.CancelError(
                    `Transcription ${jobId} did not complete in time (status: ${status}). `
                    + 'Use the Get Transcription component with this job id to fetch the result once it is done.'
                );
            }

            return context.setTimeout({ jobId, deadline, pollIntervalMs }, pollIntervalMs);
        }

        const {
            audioUrl,
            diarization,
            translation,
            translationTargetLanguages,
            summarization,
            subtitles,
            sentimentAnalysis,
            piiRedaction,
            languages,
            customMetadata,
            wait,
            pollingTimeout
        } = context.messages.in.content;

        if (!audioUrl) {
            throw new context.CancelError('Audio URL is required!');
        }

        const payload = { audio_url: audioUrl };

        if (diarization) {
            payload.diarization = true;
        }
        if (translation) {
            payload.translation = true;
            const targets = parseCsv(translationTargetLanguages);
            if (targets.length) {
                payload.translation_config = { target_languages: targets };
            }
        }
        if (summarization) {
            payload.summarization = true;
        }
        if (subtitles) {
            payload.subtitles = true;
        }
        if (sentimentAnalysis) {
            payload.sentiment_analysis = true;
        }
        if (piiRedaction) {
            payload.pii_redaction = true;
        }
        const langs = parseCsv(languages);
        if (langs.length) {
            payload.language_config = { languages: langs };
        }

        // Gladia echoes custom_metadata back on the job and in the list endpoint,
        // so it is the way to correlate a job with your own records later.
        if (customMetadata) {
            if (typeof customMetadata === 'object') {
                payload.custom_metadata = customMetadata;
            } else {
                try {
                    payload.custom_metadata = JSON.parse(customMetadata);
                } catch (error) {
                    throw new context.CancelError('Custom Metadata must be valid JSON.');
                }
            }
        }

        // Gladia returns 201 with the job id and a result_url to poll.
        const created = await lib.makeRequest({
            context,
            method: 'POST',
            path: '/v2/transcription',
            data: payload
        });

        const jobId = created && created.id;
        if (!jobId) {
            throw new context.CancelError('Gladia did not return a transcription job id.');
        }

        // When the user opts out of waiting, return the created job reference and
        // let a separate Get Transcription / trigger fetch the result later.
        // Toggle values can reach the component as the string 'false'.
        if (wait === false || wait === 'false') {
            return context.sendJson(created, 'out');
        }

        const pollIntervalSeconds = MIN_POLL_INTERVAL_SECONDS;

        // The first poll cannot happen sooner than one interval from now. A
        // shorter timeout than that would spend a minute waiting only to fail
        // on a deadline that had already passed, so it is raised to one poll.
        const requestedTimeout = Number(pollingTimeout) > 0 ? Number(pollingTimeout) : 300;
        const timeoutSeconds = Math.max(requestedTimeout, pollIntervalSeconds);

        return context.setTimeout({
            jobId,
            deadline: Date.now() + timeoutSeconds * 1000,
            pollIntervalMs: pollIntervalSeconds * 1000
        }, pollIntervalSeconds * 1000);
    }
};
