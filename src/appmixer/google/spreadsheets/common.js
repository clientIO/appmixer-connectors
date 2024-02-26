'use strict';
const commons = require('../google-commons');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { parse } = require('@fast-csv/parse');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const Stream = require('stream');

const stringIsAValidUrl = s => {

    try {
        const url = new URL(s);
        return url.protocol;
    } catch (err) {
        return false;
    }
};

const getHeader = async (context, sheetId, worksheetId) => {

    const doc = new GoogleSpreadsheet(sheetId);
    doc.useOAuth2Client(commons.getAuthLibraryOAuth2Client(context.auth));
    await doc.loadInfo();
    const sheet = doc.sheetsById[worksheetId.split('/')[0]];

    await sheet.loadCells('1:1');
    const cellA1 = sheet.getCell(0, 0);
    if (cellA1.value) {
        await sheet.loadHeaderRow();
    }

    return sheet.headerValues || [];
};

/**
 * @param {Context} context
 * @param {string} fileSource - either Appmixer File ID or URL
 * @param delimiter
 * @param destroy
 * @param skipRows
 * @returns {AsyncGenerator<any, void, *>}
 */
async function* loadFile(context, fileSource, delimiter, destroy, skipRows = 0) {

    let readStream;
    let protocol = stringIsAValidUrl(fileSource);
    if (protocol) {
        readStream = new Stream.PassThrough();
        if (protocol === 'http:') {
            http.get(fileSource, (response) => {
                response.pipe(readStream);
            });
        } else if (protocol === 'https:') {
            https.get(fileSource, (response) => {
                response.pipe(readStream);
            });
        } else {
            throw new context.CancelError('Unsupported protocol: ' + protocol);
        }
    } else {
        readStream = await context.getFileReadStream(fileSource);
    }

    const parser = parse({
        delimiter: delimiter,
        trim: true,
        skipRows
    });
    readStream.pipe(parser);
    for await (const row of parser) {
        yield row;
        destroy && parser.destroy();
    }
}

module.exports = { getHeader, loadFile };
