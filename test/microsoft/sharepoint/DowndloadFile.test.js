const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pdfToText } = require('../../../src/appmixer/microsoft/sharepoint/lib');

describe('Downloads a file', function() {
    it('converts .pdf to .txt using pdfjs-dist library', async function() {
        const samplePdf = path.join(__dirname, 'files', 'sample.pdf');
        const fakeStream = fs.createReadStream(samplePdf);

        const text = await pdfToText(fakeStream);
        console.log('text from pdf: ', text);

        assert.ok(text.includes('TEST TEST TEST'), 'PDF text should include "TEST TEST TEST"');
    });

});
