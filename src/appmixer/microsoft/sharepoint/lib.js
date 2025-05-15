const { arrayBuffer } = require('node:stream/consumers');
let pdfjslib;

module.exports = {
    pdfToText: async function(stream) {
        if (!pdfjslib) {
            pdfjslib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        }

        const loadingTask = pdfjslib.getDocument({ data: await arrayBuffer(stream) });
        const pdfDoc = await loadingTask.promise;

        let fullText = '';
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const content = await page.getTextContent();
            if (content.items.length) {
                const strings = content.items.map(item => item.str || '');
                fullText += strings.join(' ') + '\n\n';
            }
        }

        return fullText;
    }
};
