'use strict';
const google = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

const sheets = google.sheets('v4');
const findRow = Promise.promisify(sheets.spreadsheets.values.get, { context: sheets.spreadsheets.values });

module.exports = {

    receive(context) {

        const worksheetName = encodeURIComponent(context.messages.in.content.worksheetId.split('/')[1]);
        return findRow({
            auth: commons.getOauth2Client(context.auth),
            spreadsheetId: context.properties.sheetId,
            range: worksheetName,
            majorDimension: 'ROWS'
        }).then(res => {
            const row = {
                count: res['values'].length
            };
            return context.sendJson(row, 'rowCount');
        });
    }
};
