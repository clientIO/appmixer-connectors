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

        let url = this.getBaseUrl(context) + `/company/contacts`;

        const headers = {};

        const inputMapping = {
            'firstName': input['firstName'],
            'lastName': input['lastName'],
            'addressLine1': input['addressLine1'],
            'addressLine2': input['addressLine2'],
            'city': input['city'],
            'state': input['state'],
            'zip': input['zip'],
            'relationshipOverride': input['relationshipOverride'],
            'inactiveFlag': input['inactiveFlag'],
            'defaultMergeContactId': input['defaultMergeContactId'],
            'securityIdentifier': input['securityIdentifier'],
            'title': input['title'],
            'school': input['school'],
            'nickName': input['nickName'],
            'marriedFlag': input['marriedFlag'],
            'childrenFlag': input['childrenFlag'],
            'children': input['children'],
            'significantOther': input['significantOther'],
            'portalPassword': input['portalPassword'],
            'portalSecurityLevel': input['portalSecurityLevel'],
            'disablePortalLoginFlag': input['disablePortalLoginFlag'],
            'unsubscribeFlag': input['unsubscribeFlag'],
            'gender': input['gender'],
            'birthDay': input['birthDay'],
            'anniversary': input['anniversary'],
            'presence': input['presence'],
            'mobileGuid': input['mobileGuid'],
            'facebookUrl': input['facebookUrl'],
            'twitterUrl': input['twitterUrl'],
            'linkedInUrl': input['linkedInUrl'],
            'defaultPhoneType': input['defaultPhoneType'],
            'defaultPhoneNbr': input['defaultPhoneNbr'],
            'defaultPhoneExtension': input['defaultPhoneExtension'],
            'defaultBillingFlag': input['defaultBillingFlag'],
            'defaultFlag': input['defaultFlag'],
            'userDefinedField1': input['userDefinedField1'],
            'userDefinedField2': input['userDefinedField2'],
            'userDefinedField3': input['userDefinedField3'],
            'userDefinedField4': input['userDefinedField4'],
            'userDefinedField5': input['userDefinedField5'],
            'userDefinedField6': input['userDefinedField6'],
            'userDefinedField7': input['userDefinedField7'],
            'userDefinedField8': input['userDefinedField8'],
            'userDefinedField9': input['userDefinedField9'],
            'userDefinedField10': input['userDefinedField10'],
            'communicationItems': input['communicationItems'],
            'types': input['types'],
            'integratorTags': input['integratorTags'],
            'customFields': input['customFields'],
            'ignoreDuplicates': input['ignoreDuplicates'],
            'typeIds': input['typeIds'],
            'company.id': input['company|id'],
            'company.identifier': input['company|identifier'],
            'company.name': input['company|name'],
            'company._info': input['company|_info'],
            'site.id': input['site|id'],
            'site.name': input['site|name'],
            'site._info': input['site|_info'],
            'country.id': input['country|id'],
            'country.identifier': input['country|identifier'],
            'country.name': input['country|name'],
            'country._info': input['country|_info'],
            'relationship.id': input['relationship|id'],
            'relationship.name': input['relationship|name'],
            'relationship._info': input['relationship|_info'],
            'department.id': input['department|id'],
            'department.name': input['department|name'],
            'department._info': input['department|_info'],
            'managerContact.id': input['managerContact|id'],
            'managerContact.name': input['managerContact|name'],
            'managerContact._info': input['managerContact|_info'],
            'assistantContact.id': input['assistantContact|id'],
            'assistantContact.name': input['assistantContact|name'],
            'assistantContact._info': input['assistantContact|_info'],
            'companyLocation.id': input['companyLocation|id'],
            'companyLocation.name': input['companyLocation|name'],
            'companyLocation._info': input['companyLocation|_info'],
            'photo.id': input['photo|id'],
            'photo.name': input['photo|name'],
            'photo._info': input['photo|_info'],
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