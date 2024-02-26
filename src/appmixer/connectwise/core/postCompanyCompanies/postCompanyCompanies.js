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

        let url = this.getBaseUrl(context) + `/company/companies`;

        const headers = {};

        const inputMapping = {
            'identifier': input['identifier'],
            'name': input['name'],
            'addressLine1': input['addressLine1'],
            'addressLine2': input['addressLine2'],
            'city': input['city'],
            'state': input['state'],
            'zip': input['zip'],
            'phoneNumber': input['phoneNumber'],
            'faxNumber': input['faxNumber'],
            'website': input['website'],
            'accountNumber': input['accountNumber'],
            'dateAcquired': input['dateAcquired'],
            'annualRevenue': input['annualRevenue'],
            'numberOfEmployees': input['numberOfEmployees'],
            'yearEstablished': input['yearEstablished'],
            'revenueYear': input['revenueYear'],
            'leadSource': input['leadSource'],
            'leadFlag': input['leadFlag'],
            'unsubscribeFlag': input['unsubscribeFlag'],
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
            'vendorIdentifier': input['vendorIdentifier'],
            'taxIdentifier': input['taxIdentifier'],
            'invoiceToEmailAddress': input['invoiceToEmailAddress'],
            'invoiceCCEmailAddress': input['invoiceCCEmailAddress'],
            'deletedFlag': input['deletedFlag'],
            'dateDeleted': input['dateDeleted'],
            'deletedBy': input['deletedBy'],
            'mobileGuid': input['mobileGuid'],
            'facebookUrl': input['facebookUrl'],
            'twitterUrl': input['twitterUrl'],
            'linkedInUrl': input['linkedInUrl'],
            'resellerIdentifier': input['resellerIdentifier'],
            'isVendorFlag': input['isVendorFlag'],
            'types': input['types'],
            'integratorTags': input['integratorTags'],
            'customFields': input['customFields'],
            'status.id': input['status|id'],
            'status.name': input['status|name'],
            'status._info': input['status|_info'],
            'country.id': input['country|id'],
            'country.identifier': input['country|identifier'],
            'country.name': input['country|name'],
            'country._info': input['country|_info'],
            'territory.id': input['territory|id'],
            'territory.name': input['territory|name'],
            'territory._info': input['territory|_info'],
            'market.id': input['market|id'],
            'market.name': input['market|name'],
            'market._info': input['market|_info'],
            'defaultContact.id': input['defaultContact|id'],
            'defaultContact.name': input['defaultContact|name'],
            'defaultContact._info': input['defaultContact|_info'],
            'sicCode.id': input['sicCode|id'],
            'sicCode.name': input['sicCode|name'],
            'sicCode._info': input['sicCode|_info'],
            'parentCompany.id': input['parentCompany|id'],
            'parentCompany.identifier': input['parentCompany|identifier'],
            'parentCompany.name': input['parentCompany|name'],
            'parentCompany._info': input['parentCompany|_info'],
            'ownershipType.id': input['ownershipType|id'],
            'ownershipType.name': input['ownershipType|name'],
            'ownershipType._info': input['ownershipType|_info'],
            'timeZoneSetup.id': input['timeZoneSetup|id'],
            'timeZoneSetup.name': input['timeZoneSetup|name'],
            'timeZoneSetup._info': input['timeZoneSetup|_info'],
            'calendar.id': input['calendar|id'],
            'calendar.name': input['calendar|name'],
            'calendar._info': input['calendar|_info'],
            'taxCode.id': input['taxCode|id'],
            'taxCode.name': input['taxCode|name'],
            'taxCode._info': input['taxCode|_info'],
            'billingTerms.id': input['billingTerms|id'],
            'billingTerms.name': input['billingTerms|name'],
            'billingTerms._info': input['billingTerms|_info'],
            'invoiceTemplate.id': input['invoiceTemplate|id'],
            'invoiceTemplate.name': input['invoiceTemplate|name'],
            'invoiceTemplate._info': input['invoiceTemplate|_info'],
            'pricingSchedule.id': input['pricingSchedule|id'],
            'pricingSchedule.name': input['pricingSchedule|name'],
            'pricingSchedule._info': input['pricingSchedule|_info'],
            'companyEntityType.id': input['companyEntityType|id'],
            'companyEntityType.name': input['companyEntityType|name'],
            'companyEntityType._info': input['companyEntityType|_info'],
            'billToCompany.id': input['billToCompany|id'],
            'billToCompany.identifier': input['billToCompany|identifier'],
            'billToCompany.name': input['billToCompany|name'],
            'billToCompany._info': input['billToCompany|_info'],
            'billingSite.id': input['billingSite|id'],
            'billingSite.name': input['billingSite|name'],
            'billingSite._info': input['billingSite|_info'],
            'billingContact.id': input['billingContact|id'],
            'billingContact.name': input['billingContact|name'],
            'billingContact._info': input['billingContact|_info'],
            'invoiceDeliveryMethod.id': input['invoiceDeliveryMethod|id'],
            'invoiceDeliveryMethod.name': input['invoiceDeliveryMethod|name'],
            'invoiceDeliveryMethod._info': input['invoiceDeliveryMethod|_info'],
            'currency.id': input['currency|id'],
            'currency.symbol': input['currency|symbol'],
            'currency.currencyCode': input['currency|currencyCode'],
            'currency.decimalSeparator': input['currency|decimalSeparator'],
            'currency.numberOfDecimals': input['currency|numberOfDecimals'],
            'currency.thousandsSeparator': input['currency|thousandsSeparator'],
            'currency.negativeParenthesesFlag': input['currency|negativeParenthesesFlag'],
            'currency.displaySymbolFlag': input['currency|displaySymbolFlag'],
            'currency.currencyIdentifier': input['currency|currencyIdentifier'],
            'currency.displayIdFlag': input['currency|displayIdFlag'],
            'currency.rightAlign': input['currency|rightAlign'],
            'currency.name': input['currency|name'],
            'currency._info': input['currency|_info'],
            'territoryManager.id': input['territoryManager|id'],
            'territoryManager.identifier': input['territoryManager|identifier'],
            'territoryManager.name': input['territoryManager|name'],
            'territoryManager._info': input['territoryManager|_info'],
            'site.id': input['site|id'],
            'site.name': input['site|name'],
            'site._info': input['site|_info'],
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