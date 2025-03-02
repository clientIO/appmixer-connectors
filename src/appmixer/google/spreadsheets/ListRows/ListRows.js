'use strict';
const google = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

const sheets = google.sheets('v4');
const listRows = Promise.promisify(sheets.spreadsheets.values.get, { context: sheets.spreadsheets.values });

module.exports = {

    receive(context) {

        const worksheetName = encodeURIComponent(context.properties.worksheetId.split('/')[1]);
        return listRows({
            auth: commons.getOauth2Client(context.auth),
            spreadsheetId: context.properties.sheetId,
            range: worksheetName
        }).then(res => {
            return context.sendJson(res['values'], 'out');
        });
    }
};
