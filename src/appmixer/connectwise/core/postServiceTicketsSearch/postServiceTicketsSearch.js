'use strict';

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.xConnectorOutputType);
        }

        const limit = context.messages.in.content.xConnectorPaginationLimit;
        const query = {
            'pageSize': limit
        };
        let data;
        let headers;
        let result;
        let links;
        let hasMore;

        // Get first page.
        ({
            data,
            headers
        } = await this.httpRequest(context, {
            query: query
        }));
        links = this.parseLinkHeader(headers.link);
        result = data.slice(0, limit);

        hasMore = result.length > 0 && links.next;
        // Repeat for other pages.
        while (hasMore && result.length < limit) {
            ({
                data,
                headers
            } = await this.httpRequest(context, {
                url: links.next
            }));
            links = this.parseLinkHeader(headers.link);
            result = result.concat(data);
            hasMore = result.length > 0 && links.next;
        }

        if (context.messages.in.content.xConnectorOutputType === 'object') {
            return context.sendArray(result, 'out');
        } else {
            // array
            return context.sendJson({
                result
            }, 'out');
        }
    },

    httpRequest: async function(context, override = {}) {

        const input = context.messages.in.content;

        let url = this.getBaseUrl(context) + '/service/tickets/search';

        const headers = {};
        const query = new URLSearchParams;

        const inputMapping = {
            'conditions': input['conditions'],
            'orderBy': input['orderBy'],
            'childconditions': input['childconditions'],
            'customfieldconditions': input['customfieldconditions']
        };
        let body = {};
        this.setProperties(body, inputMapping);

        const queryParameters = {};

        if (override && override.query) {
            Object.keys(override.query).forEach(parameter => {
                queryParameters[parameter] = override.query[parameter];
            });
        }

        Object.keys(queryParameters).forEach(parameter => {
            if (queryParameters[parameter]) {
                query.append(parameter, queryParameters[parameter]);
            }
        });

        const req = {
            url: url,
            method: 'POST',
            data: body,
            headers: headers
        };

        if (override.url) req.url = override.url;
        if (override.body) req.data = override.body;
        if (override.headers) req.headers = override.headers;
        if (override.method) req.method = override.method;

        const queryString = query.toString();
        if (queryString) {
            req.url += '?' + queryString;
        }

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
    },

    getOutputPortOptions: function(context, xConnectorOutputType) {

        if (xConnectorOutputType === 'object') {
            return context.sendJson(this.objectOutputOptions, 'out');
        } else if (xConnectorOutputType === 'array') {
            return context.sendJson(this.arrayOutputOptions, 'out');
        }
    },

    arrayOutputOptions: [{
        'label': 'Result',
        'value': 'result',
        'schema': {
            'type': 'array',
            'items': {
                'required': [
                    'summary'
                ],
                'type': 'object',
                'properties': {
                    'id': {
                        'type': 'integer'
                    },
                    'summary': {
                        'type': 'string',
                        'description': ' Max length: 100;'
                    },
                    'recordType': {
                        'enum': [
                            'ProjectIssue',
                            'ProjectTicket',
                            'ServiceTicket'
                        ],
                        'type': 'string',
                        'nullable': true
                    },
                    'board': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'status': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'workRole': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'workType': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'company': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'identifier': {
                                'type': 'string'
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'site': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'siteName': {
                        'type': 'string',
                        'description': ' Max length: 50;'
                    },
                    'addressLine1': {
                        'type': 'string',
                        'description': ' Max length: 50;'
                    },
                    'addressLine2': {
                        'type': 'string',
                        'description': ' Max length: 50;'
                    },
                    'city': {
                        'type': 'string',
                        'description': ' Max length: 50;'
                    },
                    'stateIdentifier': {
                        'type': 'string',
                        'description': ' Max length: 50;'
                    },
                    'zip': {
                        'type': 'string',
                        'description': ' Max length: 12;'
                    },
                    'country': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'identifier': {
                                'type': 'string'
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'contact': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'contactName': {
                        'type': 'string',
                        'description': ' Max length: 62;'
                    },
                    'contactPhoneNumber': {
                        'type': 'string',
                        'description': ' Max length: 20;'
                    },
                    'contactPhoneExtension': {
                        'type': 'string',
                        'description': ' Max length: 15;'
                    },
                    'contactEmailAddress': {
                        'type': 'string',
                        'description': ' Max length: 250;'
                    },
                    'type': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'subType': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'item': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'team': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'owner': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'identifier': {
                                'type': 'string'
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'priority': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            'sort': {
                                'type': 'integer',
                                'nullable': true
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'serviceLocation': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'source': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'requiredDate': {
                        'type': 'string',
                        'format': 'date-time'
                    },
                    'budgetHours': {
                        'type': 'number',
                        'nullable': true
                    },
                    'opportunity': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'agreement': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            'type': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'severity': {
                        'enum': [
                            'Low',
                            'Medium',
                            'High'
                        ],
                        'type': 'string',
                        'description': ' Required On Updates;',
                        'nullable': true
                    },
                    'impact': {
                        'enum': [
                            'Low',
                            'Medium',
                            'High'
                        ],
                        'type': 'string',
                        'description': ' Required On Updates;',
                        'nullable': true
                    },
                    'externalXRef': {
                        'type': 'string',
                        'description': ' Max length: 100;'
                    },
                    'poNumber': {
                        'type': 'string',
                        'description': ' Max length: 50;'
                    },
                    'knowledgeBaseCategoryId': {
                        'type': 'integer',
                        'nullable': true
                    },
                    'knowledgeBaseSubCategoryId': {
                        'type': 'integer',
                        'nullable': true
                    },
                    'allowAllClientsPortalView': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'customerUpdatedFlag': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'automaticEmailContactFlag': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'automaticEmailResourceFlag': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'automaticEmailCcFlag': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'automaticEmailCc': {
                        'type': 'string',
                        'description': ' Max length: 1000;'
                    },
                    'initialDescription': {
                        'type': 'string',
                        'description': 'Only available for POST, will not be returned in the response'
                    },
                    'initialInternalAnalysis': {
                        'type': 'string',
                        'description': 'Only available for POST, will not be returned in the response'
                    },
                    'initialResolution': {
                        'type': 'string',
                        'description': 'Only available for POST, will not be returned in the response'
                    },
                    'initialDescriptionFrom': {
                        'type': 'string'
                    },
                    'contactEmailLookup': {
                        'type': 'string'
                    },
                    'processNotifications': {
                        'type': 'boolean',
                        // eslint-disable-next-line max-len
                        'description': 'Can be set to false to skip notification processing when adding or updating a ticket (Defaults to True)',
                        'nullable': true
                    },
                    'skipCallback': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'closedDate': {
                        'type': 'string'
                    },
                    'closedBy': {
                        'type': 'string'
                    },
                    'closedFlag': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'actualHours': {
                        'type': 'number',
                        'nullable': true
                    },
                    'approved': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'estimatedExpenseCost': {
                        'type': 'number',
                        'nullable': true
                    },
                    'estimatedExpenseRevenue': {
                        'type': 'number',
                        'nullable': true
                    },
                    'estimatedProductCost': {
                        'type': 'number',
                        'nullable': true
                    },
                    'estimatedProductRevenue': {
                        'type': 'number',
                        'nullable': true
                    },
                    'estimatedTimeCost': {
                        'type': 'number',
                        'nullable': true
                    },
                    'estimatedTimeRevenue': {
                        'type': 'number',
                        'nullable': true
                    },
                    'billingMethod': {
                        'enum': [
                            'ActualRates',
                            'FixedFee',
                            'NotToExceed',
                            'OverrideRate'
                        ],
                        'type': 'string',
                        'nullable': true
                    },
                    'billingAmount': {
                        'type': 'number',
                        'nullable': true
                    },
                    'hourlyRate': {
                        'type': 'number',
                        'nullable': true
                    },
                    'subBillingMethod': {
                        'enum': [
                            'ActualRates',
                            'FixedFee',
                            'NotToExceed',
                            'OverrideRate'
                        ],
                        'type': 'string',
                        'nullable': true
                    },
                    'subBillingAmount': {
                        'type': 'number',
                        'nullable': true
                    },
                    'subDateAccepted': {
                        'type': 'string'
                    },
                    'dateResolved': {
                        'type': 'string'
                    },
                    'dateResplan': {
                        'type': 'string'
                    },
                    'dateResponded': {
                        'type': 'string'
                    },
                    'resolveMinutes': {
                        'type': 'integer',
                        'nullable': true
                    },
                    'resPlanMinutes': {
                        'type': 'integer',
                        'nullable': true
                    },
                    'respondMinutes': {
                        'type': 'integer',
                        'nullable': true
                    },
                    'isInSla': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'knowledgeBaseLinkId': {
                        'type': 'integer',
                        'nullable': true
                    },
                    'resources': {
                        'type': 'string'
                    },
                    'parentTicketId': {
                        'type': 'integer',
                        'nullable': true
                    },
                    'hasChildTicket': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'hasMergedChildTicketFlag': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'knowledgeBaseLinkType': {
                        'enum': [
                            'Activity',
                            'ProjectIssue',
                            'KnowledgeBaseArticle',
                            'ProjectTicket',
                            'ServiceTicket',
                            'Time'
                        ],
                        'type': 'string',
                        'nullable': true
                    },
                    'billTime': {
                        'enum': [
                            'Billable',
                            'DoNotBill',
                            'NoCharge',
                            'NoDefault'
                        ],
                        'type': 'string',
                        'nullable': true
                    },
                    'billExpenses': {
                        'enum': [
                            'Billable',
                            'DoNotBill',
                            'NoCharge',
                            'NoDefault'
                        ],
                        'type': 'string',
                        'nullable': true
                    },
                    'billProducts': {
                        'enum': [
                            'Billable',
                            'DoNotBill',
                            'NoCharge',
                            'NoDefault'
                        ],
                        'type': 'string',
                        'nullable': true
                    },
                    'predecessorType': {
                        'enum': [
                            'Ticket',
                            'Phase'
                        ],
                        'type': 'string',
                        'nullable': true
                    },
                    'predecessorId': {
                        'type': 'integer',
                        'nullable': true
                    },
                    'predecessorClosedFlag': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'lagDays': {
                        'type': 'integer',
                        'nullable': true
                    },
                    'lagNonworkingDaysFlag': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'estimatedStartDate': {
                        'type': 'string',
                        'format': 'date-time'
                    },
                    'duration': {
                        'type': 'integer',
                        'nullable': true
                    },
                    'location': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'department': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'identifier': {
                                'type': 'string'
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'mobileGuid': {
                        'type': 'string',
                        'format': 'uuid',
                        'nullable': true
                    },
                    'sla': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'slaStatus': {
                        'type': 'string'
                    },
                    'currency': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'symbol': {
                                'type': 'string'
                            },
                            'currencyCode': {
                                'type': 'string'
                            },
                            'decimalSeparator': {
                                'type': 'string'
                            },
                            'numberOfDecimals': {
                                'type': 'integer'
                            },
                            'thousandsSeparator': {
                                'type': 'string'
                            },
                            'negativeParenthesesFlag': {
                                'type': 'boolean'
                            },
                            'displaySymbolFlag': {
                                'type': 'boolean'
                            },
                            'currencyIdentifier': {
                                'type': 'string'
                            },
                            'displayIdFlag': {
                                'type': 'boolean'
                            },
                            'rightAlign': {
                                'type': 'boolean'
                            },
                            'name': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'mergedParentTicket': {
                        'type': 'object',
                        'properties': {
                            'id': {
                                'type': 'integer',
                                'nullable': true
                            },
                            'summary': {
                                'type': 'string'
                            },
                            '_info': {
                                'type': 'object',
                                'additionalProperties': {
                                    'type': 'string'
                                }
                            }
                        }
                    },
                    'integratorTags': {
                        'type': 'array',
                        'items': {
                            'type': 'string'
                        }
                    },
                    '_info': {
                        'type': 'object',
                        'additionalProperties': {
                            'type': 'string'
                        }
                    },
                    'customFields': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'id': {
                                    'type': 'integer',
                                    'nullable': true
                                },
                                'caption': {
                                    'type': 'string'
                                },
                                'type': {
                                    'enum': [
                                        'TextArea',
                                        'Button',
                                        'Currency',
                                        'Date',
                                        'Hyperlink',
                                        'IPAddress',
                                        'Checkbox',
                                        'Number',
                                        'Percent',
                                        'Text',
                                        'Password'
                                    ],
                                    'type': 'string',
                                    'nullable': true
                                },
                                'entryMethod': {
                                    'enum': [
                                        'Date',
                                        'EntryField',
                                        'List',
                                        'Option'
                                    ],
                                    'type': 'string',
                                    'nullable': true
                                },
                                'numberOfDecimals': {
                                    'type': 'integer',
                                    'nullable': true
                                },
                                'value': {
                                    'type': 'object'
                                }
                            }
                        }
                    }
                }
            }
        }
    }],

    objectOutputOptions: [{
        'label': 'Id',
        'value': 'id'
    },
    {
        'label': 'Summary',
        'value': 'summary'
    },
    {
        'label': 'Record Type',
        'value': 'recordType'
    },
    {
        'label': 'Board',
        'value': 'board'
    },
    {
        'label': 'Board Id',
        'value': 'board.id'
    },
    {
        'label': 'Board Name',
        'value': 'board.name'
    },
    {
        'label': 'Board Info',
        'value': 'board._info'
    },
    {
        'label': 'Status',
        'value': 'status'
    },
    {
        'label': 'Status Id',
        'value': 'status.id'
    },
    {
        'label': 'Status Name',
        'value': 'status.name'
    },
    {
        'label': 'Status Info',
        'value': 'status._info'
    },
    {
        'label': 'Work Role',
        'value': 'workRole'
    },
    {
        'label': 'Work Role Id',
        'value': 'workRole.id'
    },
    {
        'label': 'Work Role Name',
        'value': 'workRole.name'
    },
    {
        'label': 'Work Role Info',
        'value': 'workRole._info'
    },
    {
        'label': 'Work Type',
        'value': 'workType'
    },
    {
        'label': 'Work Type Id',
        'value': 'workType.id'
    },
    {
        'label': 'Work Type Name',
        'value': 'workType.name'
    },
    {
        'label': 'Work Type Info',
        'value': 'workType._info'
    },
    {
        'label': 'Company',
        'value': 'company'
    },
    {
        'label': 'Company Id',
        'value': 'company.id'
    },
    {
        'label': 'Company Identifier',
        'value': 'company.identifier'
    },
    {
        'label': 'Company Name',
        'value': 'company.name'
    },
    {
        'label': 'Company Info',
        'value': 'company._info'
    },
    {
        'label': 'Site',
        'value': 'site'
    },
    {
        'label': 'Site Id',
        'value': 'site.id'
    },
    {
        'label': 'Site Name',
        'value': 'site.name'
    },
    {
        'label': 'Site Info',
        'value': 'site._info'
    },
    {
        'label': 'Site Name',
        'value': 'siteName'
    },
    {
        'label': 'Address Line 1',
        'value': 'addressLine1'
    },
    {
        'label': 'Address Line 2',
        'value': 'addressLine2'
    },
    {
        'label': 'City',
        'value': 'city'
    },
    {
        'label': 'State Identifier',
        'value': 'stateIdentifier'
    },
    {
        'label': 'Zip',
        'value': 'zip'
    },
    {
        'label': 'Country',
        'value': 'country'
    },
    {
        'label': 'Country Id',
        'value': 'country.id'
    },
    {
        'label': 'Country Identifier',
        'value': 'country.identifier'
    },
    {
        'label': 'Country Name',
        'value': 'country.name'
    },
    {
        'label': 'Country Info',
        'value': 'country._info'
    },
    {
        'label': 'Contact',
        'value': 'contact'
    },
    {
        'label': 'Contact Id',
        'value': 'contact.id'
    },
    {
        'label': 'Contact Name',
        'value': 'contact.name'
    },
    {
        'label': 'Contact Info',
        'value': 'contact._info'
    },
    {
        'label': 'Contact Name',
        'value': 'contactName'
    },
    {
        'label': 'Contact Phone Number',
        'value': 'contactPhoneNumber'
    },
    {
        'label': 'Contact Phone Extension',
        'value': 'contactPhoneExtension'
    },
    {
        'label': 'Contact Email Address',
        'value': 'contactEmailAddress'
    },
    {
        'label': 'Type',
        'value': 'type'
    },
    {
        'label': 'Type Id',
        'value': 'type.id'
    },
    {
        'label': 'Type Name',
        'value': 'type.name'
    },
    {
        'label': 'Type Info',
        'value': 'type._info'
    },
    {
        'label': 'Sub Type',
        'value': 'subType'
    },
    {
        'label': 'Sub Type Id',
        'value': 'subType.id'
    },
    {
        'label': 'Sub Type Name',
        'value': 'subType.name'
    },
    {
        'label': 'Sub Type Info',
        'value': 'subType._info'
    },
    {
        'label': 'Item',
        'value': 'item'
    },
    {
        'label': 'Item Id',
        'value': 'item.id'
    },
    {
        'label': 'Item Name',
        'value': 'item.name'
    },
    {
        'label': 'Item Info',
        'value': 'item._info'
    },
    {
        'label': 'Team',
        'value': 'team'
    },
    {
        'label': 'Team Id',
        'value': 'team.id'
    },
    {
        'label': 'Team Name',
        'value': 'team.name'
    },
    {
        'label': 'Team Info',
        'value': 'team._info'
    },
    {
        'label': 'Owner',
        'value': 'owner'
    },
    {
        'label': 'Owner Id',
        'value': 'owner.id'
    },
    {
        'label': 'Owner Identifier',
        'value': 'owner.identifier'
    },
    {
        'label': 'Owner Name',
        'value': 'owner.name'
    },
    {
        'label': 'Owner Info',
        'value': 'owner._info'
    },
    {
        'label': 'Priority',
        'value': 'priority'
    },
    {
        'label': 'Priority Id',
        'value': 'priority.id'
    },
    {
        'label': 'Priority Name',
        'value': 'priority.name'
    },
    {
        'label': 'Priority Sort',
        'value': 'priority.sort'
    },
    {
        'label': 'Priority Info',
        'value': 'priority._info'
    },
    {
        'label': 'Service Location',
        'value': 'serviceLocation'
    },
    {
        'label': 'Service Location Id',
        'value': 'serviceLocation.id'
    },
    {
        'label': 'Service Location Name',
        'value': 'serviceLocation.name'
    },
    {
        'label': 'Service Location Info',
        'value': 'serviceLocation._info'
    },
    {
        'label': 'Source',
        'value': 'source'
    },
    {
        'label': 'Source Id',
        'value': 'source.id'
    },
    {
        'label': 'Source Name',
        'value': 'source.name'
    },
    {
        'label': 'Source Info',
        'value': 'source._info'
    },
    {
        'label': 'Required Date',
        'value': 'requiredDate'
    },
    {
        'label': 'Budget Hours',
        'value': 'budgetHours'
    },
    {
        'label': 'Opportunity',
        'value': 'opportunity'
    },
    {
        'label': 'Opportunity Id',
        'value': 'opportunity.id'
    },
    {
        'label': 'Opportunity Name',
        'value': 'opportunity.name'
    },
    {
        'label': 'Opportunity Info',
        'value': 'opportunity._info'
    },
    {
        'label': 'Agreement',
        'value': 'agreement'
    },
    {
        'label': 'Agreement Id',
        'value': 'agreement.id'
    },
    {
        'label': 'Agreement Name',
        'value': 'agreement.name'
    },
    {
        'label': 'Agreement Type',
        'value': 'agreement.type'
    },
    {
        'label': 'Agreement Info',
        'value': 'agreement._info'
    },
    {
        'label': 'Severity',
        'value': 'severity'
    },
    {
        'label': 'Impact',
        'value': 'impact'
    },
    {
        'label': 'External X Ref',
        'value': 'externalXRef'
    },
    {
        'label': 'Po Number',
        'value': 'poNumber'
    },
    {
        'label': 'Knowledge Base Category Id',
        'value': 'knowledgeBaseCategoryId'
    },
    {
        'label': 'Knowledge Base Sub Category Id',
        'value': 'knowledgeBaseSubCategoryId'
    },
    {
        'label': 'Allow All Clients Portal View',
        'value': 'allowAllClientsPortalView'
    },
    {
        'label': 'Customer Updated Flag',
        'value': 'customerUpdatedFlag'
    },
    {
        'label': 'Automatic Email Contact Flag',
        'value': 'automaticEmailContactFlag'
    },
    {
        'label': 'Automatic Email Resource Flag',
        'value': 'automaticEmailResourceFlag'
    },
    {
        'label': 'Automatic Email Cc Flag',
        'value': 'automaticEmailCcFlag'
    },
    {
        'label': 'Automatic Email Cc',
        'value': 'automaticEmailCc'
    },
    {
        'label': 'Initial Description',
        'value': 'initialDescription'
    },
    {
        'label': 'Initial Internal Analysis',
        'value': 'initialInternalAnalysis'
    },
    {
        'label': 'Initial Resolution',
        'value': 'initialResolution'
    },
    {
        'label': 'Initial Description From',
        'value': 'initialDescriptionFrom'
    },
    {
        'label': 'Contact Email Lookup',
        'value': 'contactEmailLookup'
    },
    {
        'label': 'Process Notifications',
        'value': 'processNotifications'
    },
    {
        'label': 'Skip Callback',
        'value': 'skipCallback'
    },
    {
        'label': 'Closed Date',
        'value': 'closedDate'
    },
    {
        'label': 'Closed By',
        'value': 'closedBy'
    },
    {
        'label': 'Closed Flag',
        'value': 'closedFlag'
    },
    {
        'label': 'Actual Hours',
        'value': 'actualHours'
    },
    {
        'label': 'Approved',
        'value': 'approved'
    },
    {
        'label': 'Estimated Expense Cost',
        'value': 'estimatedExpenseCost'
    },
    {
        'label': 'Estimated Expense Revenue',
        'value': 'estimatedExpenseRevenue'
    },
    {
        'label': 'Estimated Product Cost',
        'value': 'estimatedProductCost'
    },
    {
        'label': 'Estimated Product Revenue',
        'value': 'estimatedProductRevenue'
    },
    {
        'label': 'Estimated Time Cost',
        'value': 'estimatedTimeCost'
    },
    {
        'label': 'Estimated Time Revenue',
        'value': 'estimatedTimeRevenue'
    },
    {
        'label': 'Billing Method',
        'value': 'billingMethod'
    },
    {
        'label': 'Billing Amount',
        'value': 'billingAmount'
    },
    {
        'label': 'Hourly Rate',
        'value': 'hourlyRate'
    },
    {
        'label': 'Sub Billing Method',
        'value': 'subBillingMethod'
    },
    {
        'label': 'Sub Billing Amount',
        'value': 'subBillingAmount'
    },
    {
        'label': 'Sub Date Accepted',
        'value': 'subDateAccepted'
    },
    {
        'label': 'Date Resolved',
        'value': 'dateResolved'
    },
    {
        'label': 'Date Resplan',
        'value': 'dateResplan'
    },
    {
        'label': 'Date Responded',
        'value': 'dateResponded'
    },
    {
        'label': 'Resolve Minutes',
        'value': 'resolveMinutes'
    },
    {
        'label': 'Res Plan Minutes',
        'value': 'resPlanMinutes'
    },
    {
        'label': 'Respond Minutes',
        'value': 'respondMinutes'
    },
    {
        'label': 'Is In Sla',
        'value': 'isInSla'
    },
    {
        'label': 'Knowledge Base Link Id',
        'value': 'knowledgeBaseLinkId'
    },
    {
        'label': 'Resources',
        'value': 'resources'
    },
    {
        'label': 'Parent Ticket Id',
        'value': 'parentTicketId'
    },
    {
        'label': 'Has Child Ticket',
        'value': 'hasChildTicket'
    },
    {
        'label': 'Has Merged Child Ticket Flag',
        'value': 'hasMergedChildTicketFlag'
    },
    {
        'label': 'Knowledge Base Link Type',
        'value': 'knowledgeBaseLinkType'
    },
    {
        'label': 'Bill Time',
        'value': 'billTime'
    },
    {
        'label': 'Bill Expenses',
        'value': 'billExpenses'
    },
    {
        'label': 'Bill Products',
        'value': 'billProducts'
    },
    {
        'label': 'Predecessor Type',
        'value': 'predecessorType'
    },
    {
        'label': 'Predecessor Id',
        'value': 'predecessorId'
    },
    {
        'label': 'Predecessor Closed Flag',
        'value': 'predecessorClosedFlag'
    },
    {
        'label': 'Lag Days',
        'value': 'lagDays'
    },
    {
        'label': 'Lag Nonworking Days Flag',
        'value': 'lagNonworkingDaysFlag'
    },
    {
        'label': 'Estimated Start Date',
        'value': 'estimatedStartDate'
    },
    {
        'label': 'Duration',
        'value': 'duration'
    },
    {
        'label': 'Location',
        'value': 'location'
    },
    {
        'label': 'Location Id',
        'value': 'location.id'
    },
    {
        'label': 'Location Name',
        'value': 'location.name'
    },
    {
        'label': 'Location Info',
        'value': 'location._info'
    },
    {
        'label': 'Department',
        'value': 'department'
    },
    {
        'label': 'Department Id',
        'value': 'department.id'
    },
    {
        'label': 'Department Identifier',
        'value': 'department.identifier'
    },
    {
        'label': 'Department Name',
        'value': 'department.name'
    },
    {
        'label': 'Department Info',
        'value': 'department._info'
    },
    {
        'label': 'Mobile Guid',
        'value': 'mobileGuid'
    },
    {
        'label': 'Sla',
        'value': 'sla'
    },
    {
        'label': 'Sla Id',
        'value': 'sla.id'
    },
    {
        'label': 'Sla Name',
        'value': 'sla.name'
    },
    {
        'label': 'Sla Info',
        'value': 'sla._info'
    },
    {
        'label': 'Sla Status',
        'value': 'slaStatus'
    },
    {
        'label': 'Currency',
        'value': 'currency'
    },
    {
        'label': 'Currency Id',
        'value': 'currency.id'
    },
    {
        'label': 'Currency Symbol',
        'value': 'currency.symbol'
    },
    {
        'label': 'Currency Currency Code',
        'value': 'currency.currencyCode'
    },
    {
        'label': 'Currency Decimal Separator',
        'value': 'currency.decimalSeparator'
    },
    {
        'label': 'Currency Number Of Decimals',
        'value': 'currency.numberOfDecimals'
    },
    {
        'label': 'Currency Thousands Separator',
        'value': 'currency.thousandsSeparator'
    },
    {
        'label': 'Currency Negative Parentheses Flag',
        'value': 'currency.negativeParenthesesFlag'
    },
    {
        'label': 'Currency Display Symbol Flag',
        'value': 'currency.displaySymbolFlag'
    },
    {
        'label': 'Currency Currency Identifier',
        'value': 'currency.currencyIdentifier'
    },
    {
        'label': 'Currency Display Id Flag',
        'value': 'currency.displayIdFlag'
    },
    {
        'label': 'Currency Right Align',
        'value': 'currency.rightAlign'
    },
    {
        'label': 'Currency Name',
        'value': 'currency.name'
    },
    {
        'label': 'Currency Info',
        'value': 'currency._info'
    },
    {
        'label': 'Merged Parent Ticket',
        'value': 'mergedParentTicket'
    },
    {
        'label': 'Merged Parent Ticket Id',
        'value': 'mergedParentTicket.id'
    },
    {
        'label': 'Merged Parent Ticket Summary',
        'value': 'mergedParentTicket.summary'
    },
    {
        'label': 'Merged Parent Ticket Info',
        'value': 'mergedParentTicket._info'
    },
    {
        'label': 'Integrator Tags',
        'value': 'integratorTags',
        'schema': {
            'type': 'array',
            'items': {
                'type': 'string'
            }
        }
    },
    {
        'label': 'Info',
        'value': '_info'
    },
    {
        'label': 'Custom Fields',
        'value': 'customFields',
        'schema': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'id': {
                        'type': 'integer',
                        'nullable': true
                    },
                    'caption': {
                        'type': 'string'
                    },
                    'type': {
                        'enum': [
                            'TextArea',
                            'Button',
                            'Currency',
                            'Date',
                            'Hyperlink',
                            'IPAddress',
                            'Checkbox',
                            'Number',
                            'Percent',
                            'Text',
                            'Password'
                        ],
                        'type': 'string',
                        'nullable': true
                    },
                    'entryMethod': {
                        'enum': [
                            'Date',
                            'EntryField',
                            'List',
                            'Option'
                        ],
                        'type': 'string',
                        'nullable': true
                    },
                    'numberOfDecimals': {
                        'type': 'integer',
                        'nullable': true
                    },
                    'value': {
                        'type': 'object'
                    }
                }
            }
        }
    }
    ],

    parseLinkHeader: function(header) {

        const links = {};
        if (header.length === 0) {
            return links;
        }
        const parts = header.split(',');
        // Parse each part into a named link.
        for (let i = 0; i < parts.length; i++) {
            const section = parts[i].split(';');
            if (section.length !== 2) {
                throw new Error('Section could not be split on ";". Link header: ' + JSON.stringify(header));
            }
            const url = section[0].replace(/<(.*)>/, '$1').trim();
            const name = section[1].replace(/rel="(.*)"/, '$1').trim();
            links[name] = url;
        }
        return links;
    }

};
