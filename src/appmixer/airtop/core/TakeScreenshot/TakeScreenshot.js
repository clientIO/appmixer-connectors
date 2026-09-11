'use strict';

const pathModule = require('path');
const lib = require('../../lib');

// The screenshot is stored as an Appmixer file and only its ID travels in the
// message. The image itself must never be emitted: Airtop returns it as a base64
// data URL, base64 inflates it by a third, and the broker CANCELS - does not retry -
// any message over BROKER_SERVER_MAX_MESSAGE_SIZE_BYTES (2 MB by default). A file ID
// is also what every downstream component (upload, e-mail attachment, vision model)
// actually consumes.
const IMAGE_FORMAT = 'base64';
// data:<mime>;base64,<payload> - `s` so a payload containing newlines still matches.
const DATA_URL_PATTERN = /^data:([^;,]*);base64,(.*)$/s;
const EXTENSIONS = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
};
const DEFAULT_EXTENSION = 'jpg';
// Airtop scales to fit; anything larger is a typo rather than an intent.
const MAX_DIMENSION_PX = 10000;

module.exports = {

    async receive(context) {

        const {
            sessionId,
            windowId,
            maxWidth,
            maxHeight,
            costThresholdCredits,
            timeThresholdSeconds
        } = context.messages.in.content;

        if (!sessionId) {
            throw new context.CancelError('Session ID is required!');
        }
        if (!windowId) {
            throw new context.CancelError('Window ID is required!');
        }

        const screenshot = { format: IMAGE_FORMAT };

        const width = lib.parseIntegerInput(context, maxWidth, {
            label: 'Max Width',
            min: 1,
            max: MAX_DIMENSION_PX
        });
        if (width !== undefined) {
            screenshot.maxWidth = width;
        }

        const height = lib.parseIntegerInput(context, maxHeight, {
            label: 'Max Height',
            min: 1,
            max: MAX_DIMENSION_PX
        });
        if (height !== undefined) {
            screenshot.maxHeight = height;
        }

        const payload = { configuration: { screenshot } };

        lib.applyThresholds(context, payload, { costThresholdCredits, timeThresholdSeconds });

        const { data } = await lib.apiRequest(context, {
            method: 'POST',
            path: `/sessions/${encodeURIComponent(sessionId)}/windows/${encodeURIComponent(windowId)}/screenshot`,
            data: payload
        });

        const result = lib.aiResult(context, data);

        // The image is delivered in the response metadata, not in the data envelope.
        // Reporting success with no image would hand a downstream component an empty
        // message even though the credits were already spent.
        if (!result.screenshots.length) {
            throw new context.CancelError(
                `Airtop returned no screenshot. Request ID: ${result.requestId || 'unknown'}.`
            );
        }

        const image = result.screenshots[0];
        const { buffer, extension } = decodeDataUrl(context, image.dataUrl, result.requestId);
        const fileName = safeFileName(image.fileName, extension);
        const savedFile = await context.saveFileStream(fileName, buffer);

        await context.log({ step: 'Screenshot saved', fileName, fileId: savedFile.fileId });

        return context.sendJson({
            fileId: savedFile.fileId,
            fileName,
            fileSize: buffer.length,
            status: result.status,
            requestId: result.requestId,
            credits: result.credits
        }, 'out');
    }
};

/**
 * Decode the base64 data URL Airtop returns into the raw image bytes.
 * @param {object} context
 * @param {string} dataUrl
 * @param {string} requestId - quoted in the error so a failure can be traced in Airtop
 * @returns {{ buffer: Buffer, extension: string }}
 */
function decodeDataUrl(context, dataUrl, requestId) {

    const match = DATA_URL_PATTERN.exec(String(dataUrl || ''));

    if (!match) {
        throw new context.CancelError(
            'Airtop returned the screenshot in an unexpected format (no base64 data URL). '
            + `Request ID: ${requestId || 'unknown'}.`
        );
    }

    const buffer = Buffer.from(match[2], 'base64');

    if (!buffer.length) {
        throw new context.CancelError(
            `Airtop returned an empty screenshot. Request ID: ${requestId || 'unknown'}.`
        );
    }

    return { buffer, extension: EXTENSIONS[match[1].toLowerCase()] || DEFAULT_EXTENSION };
}

/**
 * The file name to store the screenshot under. Airtop supplies one, but it is
 * external input: strip any directory part so it cannot escape the file store.
 * @param {string} [reported] - fileName as reported by Airtop
 * @param {string} extension
 * @returns {string}
 */
function safeFileName(reported, extension) {

    const base = reported ? pathModule.basename(String(reported)) : '';

    return base.length ? base : `airtop-screenshot-${Date.now()}.${extension}`;
}
