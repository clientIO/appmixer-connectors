'use strict';

const lib = require('../../lib');

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const CONTENT_TYPES = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    pdf: 'application/pdf'
};

module.exports = {

    async receive(context) {

        const input = context.messages.in.content;
        if (!input.url) {
            throw new context.CancelError('Public Page URL is required!');
        }

        const format = input.format || 'png';
        const body = {
            url: input.url,
            kind: format === 'pdf' ? 'pdf' : 'screenshot',
            format,
            width: input.width ?? 1440,
            height: input.height ?? 900,
            scale: input.scale ?? 1,
            waitUntil: input.waitUntil || 'domcontentloaded',
            delay: input.delay ?? 0,
            timeout: input.timeout ?? 15000,
            darkMode: input.darkMode ?? false,
            reducedMotion: input.reducedMotion ?? true,
            blockAds: input.blockAds ?? false,
            blockTrackers: input.blockTrackers ?? false,
            blockChats: input.blockChats ?? false,
            hideCookieBanners: input.hideCookieBanners ?? false,
            hidePopups: input.hidePopups ?? false
        };

        if (format === 'jpeg') {
            body.quality = input.quality ?? 85;
            body.fullPage = input.fullPage ?? false;
        } else if (format === 'png') {
            body.fullPage = input.fullPage ?? false;
        } else {
            body.paper = input.paper || 'A4';
            body.landscape = input.landscape ?? false;
        }

        const response = await context.httpRequest({
            method: 'POST',
            url: `${lib.BASE_URL}/v1/render`,
            headers: {
                ...lib.authHeaders(context),
                'Content-Type': 'application/json'
            },
            data: body,
            responseType: 'arraybuffer',
            maxContentLength: MAX_FILE_BYTES,
            maxBodyLength: MAX_FILE_BYTES
        });

        const contentType = String(response.headers?.['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
        if (contentType !== CONTENT_TYPES[format]) {
            throw new context.CancelError(`Latchshot returned ${contentType || 'an unknown media type'} instead of ${CONTENT_TYPES[format]}.`);
        }

        const declaredLength = lib.optionalIntegerHeader(response.headers, 'content-length');
        if (declaredLength !== undefined && declaredLength > MAX_FILE_BYTES) {
            throw new context.CancelError('Latchshot artifact exceeded the 15 MB connector limit.');
        }

        const bytes = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);
        if (bytes.length === 0) {
            throw new context.CancelError('Latchshot returned an empty artifact.');
        }
        if (bytes.length > MAX_FILE_BYTES) {
            throw new context.CancelError('Latchshot artifact exceeded the 15 MB connector limit.');
        }

        const extension = format === 'jpeg' ? 'jpg' : format;
        const filename = `latchshot-${Date.now()}.${extension}`;
        const file = await context.saveFileStream(filename, bytes);

        return context.sendJson({
            fileId: file.fileId,
            filename,
            contentType,
            fileSize: bytes.length,
            renderMs: lib.optionalIntegerHeader(response.headers, 'x-latchshot-render-ms'),
            quotaRemaining: lib.optionalIntegerHeader(response.headers, 'x-quota-remaining')
        }, 'out');
    }
};
