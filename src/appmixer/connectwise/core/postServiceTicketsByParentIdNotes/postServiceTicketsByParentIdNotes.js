'use strict';

module.exports = {

    receive: async function(context) {

        const {
            data
        } = await this.httpRequest(context);

        return context.sendJson(data, 'out');
    },

    httpRequest: async function(context) {

        const input = context.messages.in.content;

        let url = this.getBaseUrl(context) + `/service/tickets/${input['parentId']}/notes`;

        const headers = {};

        const inputMapping = {
            'text': input['text'],
            'detailDescriptionFlag': input['detailDescriptionFlag'],
            'internalAnalysisFlag': input['internalAnalysisFlag'],
            'resolutionFlag': input['resolutionFlag'],
            'issueFlag': input['issueFlag'],
            'customerUpdatedFlag': input['customerUpdatedFlag'],
            'processNotifications': input['processNotifications'],
            'dateCreated': input['dateCreated'],
            'createdBy': input['createdBy'],
            'internalFlag': input['internalFlag'],
            'externalFlag': input['externalFlag'],
            'member.id': input['member|id'],
            'member.identifier': input['member|identifier'],
            'member.name': input['member|name'],
            'member._info': input['member|_info'],
            'contact.id': input['contact|id'],
            'contact.name': input['contact|name'],
            'contact._info': input['contact|_info']
        };
        let body = {};
        this.setProperties(body, inputMapping);

        const req = {
            url: url,
            method: 'POST',
            data: body,
            headers: headers
        };

        req.headers.Authorization =
            `Basic ${btoa(context.auth.companyId + '+' + context.auth.publicKey + ':' + context.auth.privateKey)}`;
        req.headers.ClientId = context.auth.clientId;

        await context.log({
            step: 'request',
            req
        });

        const response = await context.httpRequest(req);

        await context.log({
            step: 'response',
            url,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data
        });

        return response;
    },

    getBaseUrl: function(context) {

        return (context.auth.environment === 'staging') ?
            'https://api-staging.connectwisedev.com/v4_6_release/apis/3.0/' :
            `https://api-${context.auth.environment}.myconnectwise.net/v4_6_release/apis/3.0/`;
    },

    setProperties: function(obj, mapping) {

        Object.keys(mapping || {}).forEach(path => {
            this.setProperty(obj, path, mapping[path]);
        });
    },

    setProperty: function(obj, path, value) {

        if (!obj || typeof obj !== 'object' || !path) {
            throw new Error('Invalid input');
        }

        if (typeof value === 'undefined') return;

        const pathArray = Array.isArray(path) ? path : path.split('.');
        const pathLength = pathArray.length;

        for (let i = 0; i < pathLength - 1; i++) {
            const key = pathArray[i];
            if (!obj.hasOwnProperty(key) || typeof obj[key] !== 'object') {
                obj[key] = {};
            }
            obj = obj[key];
        }

        obj[pathArray[pathLength - 1]] = value;
    }

};
