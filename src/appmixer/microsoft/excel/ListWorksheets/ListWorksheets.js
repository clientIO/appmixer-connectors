'use strict';
const request = require('request-promise');

/**
 * ListWorksheets
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { accessToken } = context.auth;
        const spreadsheetId = context.properties.sheetId;
        const worksheets = await request({
            method: 'GET',
            url: `https://graph.microsoft.com/v1.0/me/drive/items/${spreadsheetId}/workbook/worksheets`,
            auth: { bearer: accessToken },
            headers: { 'Accept': 'application/json' },
            json: true
        });

        return context.sendJson(worksheets, 'out');
    },

    /**
     * Transformer for worksheets.
     * @param {Object} worksheets
     * @param {Array<Object>} worksheets.value
     */
    worksheetsToSelectArray(worksheets) {

        if (Array.isArray(worksheets.value)) {
            return worksheets.value.map(wb => ({
                label: wb.name,
                value: wb.id
            }));
        }

        return [];
    }
};
