'use strict';

const lib = require('../lib');

function kvToObj(arr) {
    if (!Array.isArray(arr)) return {};
    const out = {};
    for (const row of arr) {
        if (!row || typeof row !== 'object') continue;
        const key = row.key;
        if (typeof key !== 'string' || key.length === 0) continue;
        out[key] = row.value;
    }
    return out;
}

// The job's input rides back in the callback URL, NOT in component state.
//
// One component instance has one callback URL, so ten parallel jobs all report
// to the same place in completion order and the webhook branch cannot see the
// message that started the job — something has to carry the input across. State
// keyed by request id looks like the obvious carrier and is the wrong one:
//
//   - Deepgram starts processing the moment it accepts the job, so the callback
//     races the state write that follows the submit. Measured margin on a 26 s
//     clip is ~0.5 s; a 1 s clip and a loaded state store close it. Losing that
//     race drops the echo AND leaves the entry behind forever, because the
//     callback's unset runs before the submit's set.
//   - A retried callback finds the entry already consumed and delivers a second
//     `done` with no echo at all.
//   - There is no TTL on component state, so a job that never calls back leaks
//     its entry permanently.
//
// The URL has none of those problems: it is per-job by construction, it is
// unaffected by write latency, and a retried callback carries the same echo.
// `utils/forms/FormAction` and `google/drive` use the same mechanism.
const ECHO_PARAM = 'echo';

function buildCallbackUrl(context, echo) {
    const base = context.getWebhookUrl();
    const separator = base.indexOf('?') === -1 ? '?' : '&';
    return `${base}${separator}${ECHO_PARAM}=${encodeURIComponent(JSON.stringify(echo))}`;
}

function readEcho(context) {
    const query = (context.messages.webhook.content || {}).query || {};
    const raw = query[ECHO_PARAM];
    if (!raw) {
        return {};
    }
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
        // A malformed echo must not cost the transcript - deliver what we have.
        return {};
    }
}

module.exports = {

    async receive(context) {

        // Deepgram delivering a finished transcript to this component's own webhook URL
        // (the default callback). The submit branch below returns only the request ID, so
        // this is where the actual transcript reaches the flow.
        if (context.messages.webhook) {

            const body = (context.messages.webhook.content || {}).data || {};
            const requestId = (body.metadata || {}).request_id;

            // Anything can POST to a webhook URL. Without this guard a stray or replayed
            // request emits a `done` carrying an empty transcript, which downstream
            // cannot tell from a real one. Acknowledge it and drop it.
            if (!requestId) {
                await context.log('warn', 'Ignoring a callback with no metadata.request_id.', { body });
                return context.response();
            }

            try {
                const alternative = body.results
                    && body.results.channels
                    && body.results.channels[0]
                    && body.results.channels[0].alternatives
                    && body.results.channels[0].alternatives[0];

                // A failed job must be visible, not an empty transcript: Deepgram reports
                // failures in the callback body (`err_code`/`err_msg`, or no `results` at
                // all). Surface it on the `done` port so downstream asserts/branches see it.
                const failure = body.err_code
                    ? `${body.err_code}${body.err_msg ? `: ${body.err_msg}` : ''}`
                    : (!body.results ? 'Deepgram delivered no results for this job.' : null);
                if (failure) {
                    await context.log('error', 'Transcription failed.', { requestId, failure, body });
                }

                await context.sendJson({
                    ...readEcho(context),
                    request_id: requestId,
                    transcript: alternative ? alternative.transcript : '',
                    ...(failure ? { error: failure } : {}),
                    metadata: body.metadata || {},
                    results: body.results || {}
                }, 'done');
            } finally {
                // Acknowledge even if the emit threw: without a 2xx Deepgram redelivers,
                // and a redelivery re-runs whatever just failed. Delivery is at-least-once
                // either way - the echo above is carried in the URL precisely so a repeat
                // is a complete duplicate rather than a degraded one.
                await context.response();
            }

            return;
        }

        const input = context.messages.in.content;
        const {
            audioUrl, fileId, model, language, detectLanguage, smartFormat,
            punctuate, diarize, summarize, sentiment, topics, intents, extraParams,
            correlationId
        } = input;

        if (!audioUrl && !fileId) {
            throw new context.CancelError('Provide either an Audio URL or a File to transcribe.');
        }

        const echo = { audioUrl, fileId, correlationId };

        const params = lib.cleanParams({
            model: model || 'nova-3',
            language,
            detect_language: detectLanguage ? 'true' : undefined,
            smart_format: smartFormat ? 'true' : undefined,
            punctuate: punctuate ? 'true' : undefined,
            diarize: diarize ? 'true' : undefined,
            summarize: summarize ? 'true' : undefined,
            sentiment: sentiment ? 'true' : undefined,
            topics: topics ? 'true' : undefined,
            intents: intents ? 'true' : undefined,
            ...kvToObj(extraParams),
            // Deepgram always calls this component back, so the transcript arrives on the
            // `done` port instead of being polled out of the request log (which lags by
            // minutes). Delivering it anywhere else is a downstream component's job.
            // AFTER the extraParams spread on purpose: a user-supplied `callback` would
            // redirect the delivery and the `done` port would silently never fire.
            callback: buildCallbackUrl(context, echo)
        });

        let data;
        let stream;
        const headers = {};

        if (audioUrl) {
            headers['Content-Type'] = 'application/json';
            data = { url: audioUrl };
        } else {
            const fileInfo = await context.getFileInfo(fileId);
            headers['Content-Type'] = lib.guessAudioContentType(fileInfo && fileInfo.filename);
            stream = await context.getFileReadStream(fileId);
            data = stream;
        }

        let response;
        try {
            response = await lib.apiRequest(context, {
                method: 'POST',
                path: '/v1/listen',
                params,
                headers,
                data
            });
        } catch (error) {
            // The upload stream is ours to close. Left open on a 413/429/5xx it holds a
            // file descriptor until GC, and an auto-retried component opens another one
            // on every attempt.
            if (stream && typeof stream.destroy === 'function') {
                stream.destroy();
            }
            throw error;
        }

        // Deepgram answers the submit immediately with just { request_id }; the transcript
        // follows on the `done` port once the callback arrives.
        const requestId = (response.data || {}).request_id;

        // No request id means the job was never linked to this flow: the callback (if any
        // arrives) cannot be attributed and `out` would carry request_id: undefined into
        // the rest of the flow. Fail loudly instead.
        if (!requestId) {
            throw new context.CancelError(
                'Deepgram accepted the request but returned no request_id, so the transcript '
                + 'cannot be delivered on the "done" port. Retry the job.'
            );
        }

        return context.sendJson({ ...echo, request_id: requestId }, 'out');
    }
};
