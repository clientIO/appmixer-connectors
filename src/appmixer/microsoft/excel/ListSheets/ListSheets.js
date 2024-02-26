'use strict';
const request = require('request-promise');

/**
 * ListSheets
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { accessToken } = context.auth;
        const workbooks = await request({
            method: 'GET',
            url: 'https://graph.microsoft.com/v1.0/me/drive/root/search(q=\'*.xlsx\')',
            auth: { bearer: accessToken },
            headers: { 'Accept': 'application/json' },
            json: true
        });

        return context.sendJson(workbooks, 'out');
    },

    /**
     * @param {Object} workbooks
     * @param {Array<Object>} workbooks.value
     * @return {Array}
     */
    sheetsToSelectArray(workbooks) {

        if (Array.isArray(workbooks.value)) {
            return workbooks.value.map(wb => ({
                label: wb.name,
                value: wb.id
            }));
        }

        return [];
    }
};
