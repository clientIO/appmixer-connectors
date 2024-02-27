'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        const { data } = await this.httpRequest(context);

        return context.sendJson(data, 'out');
    },

    httpRequest: async function(context) {

        // eslint-disable-next-line no-unused-vars
        const input = context.messages.in.content;

        let url = lib.getBaseUrl(context) + `/sheets/${input['sheetId']}/updaterequests`;

        const headers = {};

        const inputMapping = {
            'rowIds': input['rowIds'],
            'columnIds': input['columnIds'],
            'includeAttachments': input['includeAttachments'],
            'includeDiscussions': input['includeDiscussions'],
            'layout': input['layout'],
            'ccMe': input['ccMe'],
            'message': input['message'],
            'sendTo': input['sendTo'],
            'subject': input['subject'],
            'id': input['id'],
            'createdAt': input['createdAt'],
            'modifiedAt': input['modifiedAt'],
            'schedule.type': input['schedule|type'],
            'schedule.dayDescriptors': input['schedule|dayDescriptors'],
            'schedule.dayOfMonth': input['schedule|dayOfMonth'],
            'schedule.dayOrdinal': input['schedule|dayOrdinal'],
            'schedule.repeatEvery': input['schedule|repeatEvery'],
            'schedule.endAt': input['schedule|endAt'],
            'schedule.lastSentAt': input['schedule|lastSentAt'],
            'schedule.nextSendAt': input['schedule|nextSendAt'],
            'schedule.startAt': input['schedule|startAt'],
            'sentBy.email': input['sentBy|email'],
            'sentBy.name': input['sentBy|name']
        };
        let requestBody = {};
        lib.setProperties(requestBody, inputMapping);

        headers['Authorization'] = 'Bearer ' + context.auth.accessToken;

        const req = {
            url: url,
            method: 'POST',
            data: requestBody,
            headers: headers
        };

        try {
            const response = await context.httpRequest(req);
            const log = {
                step: 'http-request-success',
                request: {
                    url: req.url,
                    method: req.method,
                    headers: req.headers,
                    data: req.data
                },
                response: {
                    data: response.data,
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                }
            };
            await context.log(log);
            return response;
        } catch (err) {
            const log = {
                step: 'http-request-error',
                request: {
                    url: req.url,
                    method: req.method,
                    headers: req.headers,
                    data: req.data
                },
                response: err.response ? {
                    data: err.response.data,
                    status: err.response.status,
                    statusText: err.response.statusText,
                    headers: err.response.headers
                } : undefined
            };
            await context.log(log);
            throw err;
        }
    }

};
