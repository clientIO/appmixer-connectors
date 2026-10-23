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

/**
 * Normalize a spreadsheet header string for flexible matching.
 * Trims whitespace, replaces line breaks with a single space, and
 * collapses any remaining sequences of whitespace to a single space.
 * @param {string} header
 * @returns {string}
 */
function normalizeHeader(header) {
    if (typeof header !== 'string') return header;
    return header
        .replace(/[\r\n]+/g, ' ')  // line breaks → space
        .replace(/\s+/g, ' ')       // collapse repeated whitespace
        .trim();
}

/**
 * Convert a value to something a Google Sheets cell accepts. A cell holds only a
 * string, number or boolean; the Sheets API rejects an object or array with
 * 400 "Invalid values[...]". Objects and arrays are written as JSON strings,
 * null/undefined as an empty cell. Strings, numbers and booleans (0, false) pass unchanged.
 * @param {*} value
 * @returns {string|number|boolean}
 */
function toCellValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
}

/**
 * True when a Google API error is a 400 (invalid request). Such a request fails
 * the same way on every attempt, so it must not be retried.
 * @param {Error} err
 * @returns {boolean}
 */
function isBadRequestError(err) {
    if (!err) return false;
    const status = err.response?.status ?? err.status ?? err.code;
    return Number(status) === 400;
}

module.exports = { getHeader, loadFile, normalizeHeader, toCellValue, isBadRequestError };
