'use strict';

const path = require('path');
const lib = require('../lib');

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'];

// Extension -> real MIME type. Deriving the type from the extension string instead
// would produce `image/jpg` for a .jpg file, which is not a MIME type Mistral (or
// IMAGE_TYPES below) knows, so the image would be sent down the document path.
const EXTENSION_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif'
};
const IMAGE_EXTENSIONS = Object.keys(EXTENSION_TYPES);

const parsePages = (context, pages) => {

    const result = [];
    pages.split(',').map(part => part.trim()).filter(Boolean).forEach(part => {
        const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
        if (range) {
            for (let i = parseInt(range[1], 10); i <= parseInt(range[2], 10); i++) {
                result.push(i);
            }
        } else if (/^\d+$/.test(part)) {
            result.push(parseInt(part, 10));
        } else {
            throw new context.CancelError(`Invalid pages value: '${part}'. Use page numbers or ranges, e.g. '0-4,7'.`);
        }
    });
    return result;
};

module.exports = {

    async receive(context) {

        const { file, documentUrl, pages, model } = context.messages.in.content;

        if (!file && !documentUrl) {
            throw new context.CancelError('Either Document File or Document URL is required!');
        }

        let document;
        if (file) {
            const fileInfo = await context.getFileInfo(file);
            const fileContent = await context.loadFile(file);
            const base64 = fileContent.toString('base64');
            let contentType = fileInfo.contentType;
            if (!contentType) {
                const ext = path.extname(fileInfo.filename).toLowerCase();
                contentType = EXTENSION_TYPES[ext] || 'application/pdf';
            }
            const dataUri = `data:${contentType};base64,${base64}`;
            document = IMAGE_TYPES.includes(contentType)
                ? { type: 'image_url', image_url: dataUri }
                : { type: 'document_url', document_url: dataUri };
        } else {
            let parsedUrl;
            try {
                parsedUrl = new URL(documentUrl);
            } catch (err) {
                // Without this the raw ERR_INVALID_URL TypeError surfaces as an opaque
                // platform fault and gets retried, rather than being reported as the
                // input mistake it is.
                throw new context.CancelError('Document URL must be a valid URL.');
            }
            const ext = path.extname(parsedUrl.pathname).toLowerCase();
            document = IMAGE_EXTENSIONS.includes(ext)
                ? { type: 'image_url', image_url: documentUrl }
                : { type: 'document_url', document_url: documentUrl };
        }

        const data = {
            model: model || 'mistral-ocr-latest',
            document
        };
        if (pages) {
            data.pages = parsePages(context, pages);
        }

        // https://docs.mistral.ai/api/#tag/ocr
        const { data: response } = await context.httpRequest({
            method: 'POST',
            url: `${lib.getBaseUrl()}/ocr`,
            headers: lib.requestHeaders(context, { 'content-type': 'application/json' }),
            data
        });

        const responsePages = response?.pages || [];
        const outputData = {
            markdown: responsePages.map(page => page.markdown).join('\n\n'),
            pages: responsePages.map(page => ({ index: page.index, markdown: page.markdown })),
            pagesProcessed: response?.usage_info?.pages_processed,
            model: response?.model
        };

        return context.sendJson(outputData, 'out');
    }
};
