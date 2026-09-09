const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pdfToText } = require('../../../sharepoint/lib');

describe('Downloads a file', function() {
    it('converts .pdf to .txt using pdfjs-dist library', async function() {
        // pdfToText lazy-loads pdfjs-dist on its first call (`await import(...)`
        // of the legacy ESM build), so this test pays for the module load, not
        // just the conversion. Measured locally: 678 ms import + 39 ms convert.
        // That is a third of mocha's 2000 ms default on a warm dev machine, and
        // a shared CI runner with a cold module cache goes over it — the test
        // failed intermittently on unrelated PRs. Budget for the import.
        this.timeout(15000);

        const samplePdf = path.join(__dirname, 'files', 'sample.pdf');
        const fakeStream = fs.createReadStream(samplePdf);

        const text = await pdfToText(fakeStream);
        console.log('text from pdf: ', text);

        assert.ok(text.includes('TEST TEST TEST'), 'PDF text should include "TEST TEST TEST"');
    });

});
