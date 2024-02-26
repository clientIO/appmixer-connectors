'use strict';
const commons = require('../../google-commons');
const google = require('googleapis');
const Promise = require('bluebird');

const sheets = google.sheets('v4');
const listWorksheets = Promise.promisify(sheets.spreadsheets.get, { context: sheets.spreadsheets });

/**
 * ListWorksheets
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        return listWorksheets({
            auth: commons.getOauth2Client(context.auth),
            spreadsheetId: context.properties.sheetId
        }).then(res => {
            return context.sendJson(res['sheets'], 'out');
        });
    },

    /**
     * Transformer for worksheets.
     * @param {Array} worksheets
     */
    worksheetsToSelectArray(worksheets) {

        let transformed = [];

        if (Array.isArray(worksheets)) {
            worksheets.forEach((worksheet) => {

                transformed.push({
                    label: worksheet.properties.title,
                    value: `${worksheet.properties.sheetId}/${worksheet.properties.title}`
                });
            });
        }

        return transformed;
    }
};
