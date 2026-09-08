'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const {
            url,
            includeHtml,
            includeRawHtml,
            includeLinks,
            includeSummary,
            includeScreenshot,
            onlyMainContent,
            waitFor,
            timeout,
            mobile
        } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('URL is required!');
        }

        // Markdown is always requested; the other formats are opt-in because
        // each one adds payload size and some (summary, screenshot) cost extra
        // processing time. A toggle can reach the component as the string 'false',
        // which is truthy - so every flag is compared explicitly.
        const formats = ['markdown'];
        const optionalFormats = {
            html: includeHtml,
            rawHtml: includeRawHtml,
            links: includeLinks,
            summary: includeSummary,
            screenshot: includeScreenshot
        };
        Object.keys(optionalFormats).forEach(format => {
            if (lib.isOn(optionalFormats[format])) {
                formats.push(format);
            }
        });

        const payload = { url, formats };

        // The API defaults to true; only send the flag when the user turned it
        // off. Toggle values can reach the component as the string 'false'.
        if (onlyMainContent === false || onlyMainContent === 'false') {
            payload.onlyMainContent = false;
        }
        if (Number(waitFor) > 0) {
            payload.waitFor = Number(waitFor);
        }
        if (Number(timeout) > 0) {
            payload.timeout = Number(timeout);
        }
        if (lib.isOn(mobile)) {
            payload.mobile = true;
        }

        const response = await lib.makeRequest({
            context,
            method: 'POST',
            path: '/v2/scrape',
            data: payload
        });

        const data = (response && response.data) || {};

        return context.sendJson({
            markdown: data.markdown,
            html: data.html,
            rawHtml: data.rawHtml,
            links: data.links,
            summary: data.summary,
            screenshot: data.screenshot,
            metadata: data.metadata
        }, 'out');
    }
};
