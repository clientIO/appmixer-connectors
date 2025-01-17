'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        const { data } = await this.httpRequest(context);

        return context.sendJson(data, 'out');
    },

    httpRequest: async function(context) {

        const input = context.messages.in.content;
        context.log({ input });
        const { sheetId, rowId } = context.properties;

        // Build URL for updating rows
        const url = `${lib.getBaseUrl(context)}/sheets/${sheetId}/rows`;

        const headers = {
            'Authorization': `Bearer ${context.auth.accessToken}`,
            'Content-Type': 'application/json'
        };

        const cells = Object.entries(input).map(([columnId, value]) => ({
            columnId: columnId,
            value: value
        }));

        const rows = [{
            id: rowId,
            cells: cells
        }];

        const requestBody = rows;

        const req = {
            url: url,
            method: 'PUT',
            headers,
            data: requestBody
        };

        const response = await context.httpRequest(req);

        await context.log({
            step: 'http-request-success',
            request: req,
            response: {
                data: response.data,
                status: response.status,
                headers: response.headers
            }
        });

        return response;

    }

};
