'use strict';
const commons = require('../../google-commons');
const google = require('googleapis');
const Promise = require('bluebird');
const drive = google.drive('v3');
const listFiles = Promise.promisify(drive.files.list);

const listSheets = async function(args, sheets = [], nextPageToken = null) {

    const result = await listFiles(Object.assign(args, nextPageToken ? { pageToken: nextPageToken } : {}));
    if (result.files) {
        sheets = sheets.concat(result.files);
    }
    if (result.nextPageToken) {
        return listSheets(args, sheets, result.nextPageToken);
    }
    return sheets;
};

/**
 * ListSheets
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        google.options({ auth: commons.getOauth2Client(context.auth) });
        const sheets = await listSheets(
            { q: `mimeType='application/vnd.google-apps.spreadsheet'`, pageSize: 1000 }
        );
        return context.sendJson(sheets, 'out');
    },

    /**
     * @param {Array} files
     */
    sheetsToSelectArray(files) {

        const transformed = [];

        if (Array.isArray(files)) {
            files.forEach((sheetItem) => {

                transformed.push({
                    label: sheetItem.name,
                    value: sheetItem.id
                });
            });
        }

        return transformed;
    }
};
