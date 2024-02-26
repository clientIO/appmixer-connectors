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

        let url = this.getBaseUrl(context) + `/service/tickets/${input["id"]}`;

        const headers = {};

        const inputMapping = {
            'id': input['id'],
            'summary': input['summary'],
            'recordType': input['recordType'],
            'siteName': input['siteName'],
            'addressLine1': input['addressLine1'],
            'addressLine2': input['addressLine2'],
            'city': input['city'],
            'stateIdentifier': input['stateIdentifier'],
            'zip': input['zip'],
            'contactName': input['contactName'],
            'contactPhoneNumber': input['contactPhoneNumber'],
            'contactPhoneExtension': input['contactPhoneExtension'],
            'contactEmailAddress': input['contactEmailAddress'],
            'requiredDate': input['requiredDate'],
            'budgetHours': input['budgetHours'],
            'severity': input['severity'],
            'impact': input['impact'],
            'externalXRef': input['externalXRef'],
            'poNumber': input['poNumber'],
            'knowledgeBaseCategoryId': input['knowledgeBaseCategoryId'],
            'knowledgeBaseSubCategoryId': input['knowledgeBaseSubCategoryId'],
            'allowAllClientsPortalView': input['allowAllClientsPortalView'],
            'customerUpdatedFlag': input['customerUpdatedFlag'],
            'automaticEmailContactFlag': input['automaticEmailContactFlag'],
            'automaticEmailResourceFlag': input['automaticEmailResourceFlag'],
            'automaticEmailCcFlag': input['automaticEmailCcFlag'],
            'automaticEmailCc': input['automaticEmailCc'],
            'initialDescription': input['initialDescription'],
            'initialInternalAnalysis': input['initialInternalAnalysis'],
            'initialResolution': input['initialResolution'],
            'initialDescriptionFrom': input['initialDescriptionFrom'],
            'contactEmailLookup': input['contactEmailLookup'],
            'processNotifications': input['processNotifications'],
            'skipCallback': input['skipCallback'],
            'closedDate': input['closedDate'],
            'closedBy': input['closedBy'],
            'closedFlag': input['closedFlag'],
            'actualHours': input['actualHours'],
            'approved': input['approved'],
            'estimatedExpenseCost': input['estimatedExpenseCost'],
            'estimatedExpenseRevenue': input['estimatedExpenseRevenue'],
            'estimatedProductCost': input['estimatedProductCost'],
            'estimatedProductRevenue': input['estimatedProductRevenue'],
            'estimatedTimeCost': input['estimatedTimeCost'],
            'estimatedTimeRevenue': input['estimatedTimeRevenue'],
            'billingMethod': input['billingMethod'],
            'billingAmount': input['billingAmount'],
            'hourlyRate': input['hourlyRate'],
            'subBillingMethod': input['subBillingMethod'],
            'subBillingAmount': input['subBillingAmount'],
            'subDateAccepted': input['subDateAccepted'],
            'dateResolved': input['dateResolved'],
            'dateResplan': input['dateResplan'],
            'dateResponded': input['dateResponded'],
            'resolveMinutes': input['resolveMinutes'],
            'resPlanMinutes': input['resPlanMinutes'],
            'respondMinutes': input['respondMinutes'],
            'isInSla': input['isInSla'],
            'knowledgeBaseLinkId': input['knowledgeBaseLinkId'],
            'resources': input['resources'],
            'parentTicketId': input['parentTicketId'],
            'hasChildTicket': input['hasChildTicket'],
            'hasMergedChildTicketFlag': input['hasMergedChildTicketFlag'],
            'knowledgeBaseLinkType': input['knowledgeBaseLinkType'],
            'billTime': input['billTime'],
            'billExpenses': input['billExpenses'],
            'billProducts': input['billProducts'],
            'predecessorType': input['predecessorType'],
            'predecessorId': input['predecessorId'],
            'predecessorClosedFlag': input['predecessorClosedFlag'],
            'lagDays': input['lagDays'],
            'lagNonworkingDaysFlag': input['lagNonworkingDaysFlag'],
            'estimatedStartDate': input['estimatedStartDate'],
            'duration': input['duration'],
            'mobileGuid': input['mobileGuid'],
            'slaStatus': input['slaStatus'],
            'integratorTags': input['integratorTags'],
            'customFields': input['customFields'],
            'board.id': input['board|id'],
            'board.name': input['board|name'],
            'board._info': input['board|_info'],
            'status.id': input['status|id'],
            'status.name': input['status|name'],
            'status._info': input['status|_info'],
            'workRole.id': input['workRole|id'],
            'workRole.name': input['workRole|name'],
            'workRole._info': input['workRole|_info'],
            'workType.id': input['workType|id'],
            'workType.name': input['workType|name'],
            'workType._info': input['workType|_info'],
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
            'contact.id': input['contact|id'],
            'contact.name': input['contact|name'],
            'contact._info': input['contact|_info'],
            'type.id': input['type|id'],
            'type.name': input['type|name'],
            'type._info': input['type|_info'],
            'subType.id': input['subType|id'],
            'subType.name': input['subType|name'],
            'subType._info': input['subType|_info'],
            'item.id': input['item|id'],
            'item.name': input['item|name'],
            'item._info': input['item|_info'],
            'team.id': input['team|id'],
            'team.name': input['team|name'],
            'team._info': input['team|_info'],
            'owner.id': input['owner|id'],
            'owner.identifier': input['owner|identifier'],
            'owner.name': input['owner|name'],
            'owner._info': input['owner|_info'],
            'priority.id': input['priority|id'],
            'priority.name': input['priority|name'],
            'priority.sort': input['priority|sort'],
            'priority._info': input['priority|_info'],
            'serviceLocation.id': input['serviceLocation|id'],
            'serviceLocation.name': input['serviceLocation|name'],
            'serviceLocation._info': input['serviceLocation|_info'],
            'source.id': input['source|id'],
            'source.name': input['source|name'],
            'source._info': input['source|_info'],
            'opportunity.id': input['opportunity|id'],
            'opportunity.name': input['opportunity|name'],
            'opportunity._info': input['opportunity|_info'],
            'agreement.id': input['agreement|id'],
            'agreement.name': input['agreement|name'],
            'agreement.type': input['agreement|type'],
            'agreement._info': input['agreement|_info'],
            'location.id': input['location|id'],
            'location.name': input['location|name'],
            'location._info': input['location|_info'],
            'department.id': input['department|id'],
            'department.identifier': input['department|identifier'],
            'department.name': input['department|name'],
            'department._info': input['department|_info'],
            'sla.id': input['sla|id'],
            'sla.name': input['sla|name'],
            'sla._info': input['sla|_info'],
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
            'mergedParentTicket.id': input['mergedParentTicket|id'],
            'mergedParentTicket.summary': input['mergedParentTicket|summary'],
            'mergedParentTicket._info': input['mergedParentTicket|_info'],
        };
        let body = {};
        this.setProperties(body, inputMapping);

        const req = {
            url: url,
            method: 'PUT',
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