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

        let url = this.getBaseUrl(context) + `/service/boards`;

        const headers = {};
        const query = new URLSearchParams;

        const queryParameters = {
            'conditions': input['conditions'],
            'childConditions': input['childConditions'],
            'customFieldConditions': input['customFieldConditions'],
            'orderBy': input['orderBy'],
            'fields': input['fields'],
            'page': input['page'],
            'pageSize': input['pageSize'],
            'pageId': input['pageId']
        };

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
            method: 'GET',
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

    getOutputPortOptions: function(context, xConnectorOutputType) {

        if (xConnectorOutputType === 'object') {
            return context.sendJson(this.objectOutputOptions, 'out');
        } else if (xConnectorOutputType === 'array') {
            return context.sendJson(this.arrayOutputOptions, 'out');
        }
    },

    arrayOutputOptions: [{
        "label": "Result",
        "value": "result",
        "schema": {
            "type": "array",
            "items": {
                "required": [
                    "name"
                ],
                "type": "object",
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "name": {
                        "type": "string",
                        "description": " Max length: 50;"
                    },
                    "location": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "nullable": true
                            },
                            "name": {
                                "type": "string"
                            },
                            "_info": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "department": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "nullable": true
                            },
                            "identifier": {
                                "type": "string"
                            },
                            "name": {
                                "type": "string"
                            },
                            "_info": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "inactiveFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "signOffTemplate": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "nullable": true
                            },
                            "name": {
                                "type": "string"
                            },
                            "_info": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "sendToContactFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "contactTemplate": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "nullable": true
                            },
                            "identifier": {
                                "type": "string"
                            },
                            "name": {
                                "type": "string"
                            },
                            "type": {
                                "type": "string"
                            },
                            "_info": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "sendToResourceFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "resourceTemplate": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "nullable": true
                            },
                            "identifier": {
                                "type": "string"
                            },
                            "name": {
                                "type": "string"
                            },
                            "type": {
                                "type": "string"
                            },
                            "_info": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "projectFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "showDependenciesFlag": {
                        "type": "boolean",
                        "description": "This field only shows if it is Project Board.",
                        "nullable": true
                    },
                    "showEstimatesFlag": {
                        "type": "boolean",
                        "description": "This field only shows if it is Project Board.",
                        "nullable": true
                    },
                    "boardIcon": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "nullable": true
                            },
                            "name": {
                                "type": "string"
                            },
                            "_info": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "billTicketsAfterClosedFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "billTicketSeparatelyFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "billUnapprovedTimeExpenseFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "overrideBillingSetupFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "dispatchMember": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "nullable": true
                            },
                            "identifier": {
                                "type": "string"
                            },
                            "name": {
                                "type": "string"
                            },
                            "_info": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "serviceManagerMember": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "nullable": true
                            },
                            "identifier": {
                                "type": "string"
                            },
                            "name": {
                                "type": "string"
                            },
                            "_info": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "dutyManagerMember": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "nullable": true
                            },
                            "identifier": {
                                "type": "string"
                            },
                            "name": {
                                "type": "string"
                            },
                            "_info": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "oncallMember": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "nullable": true
                            },
                            "identifier": {
                                "type": "string"
                            },
                            "name": {
                                "type": "string"
                            },
                            "_info": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "workRole": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "nullable": true
                            },
                            "name": {
                                "type": "string"
                            },
                            "_info": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "workType": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "nullable": true
                            },
                            "name": {
                                "type": "string"
                            },
                            "_info": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "billTime": {
                        "enum": [
                            "Billable",
                            "DoNotBill",
                            "NoCharge",
                            "NoDefault"
                        ],
                        "type": "string",
                        "nullable": true
                    },
                    "billExpense": {
                        "enum": [
                            "Billable",
                            "DoNotBill",
                            "NoCharge",
                            "NoDefault"
                        ],
                        "type": "string",
                        "nullable": true
                    },
                    "billProduct": {
                        "enum": [
                            "Billable",
                            "DoNotBill",
                            "NoCharge",
                            "NoDefault"
                        ],
                        "type": "string",
                        "nullable": true
                    },
                    "autoCloseStatus": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "nullable": true
                            },
                            "name": {
                                "type": "string"
                            },
                            "_info": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "autoAssignNewTicketsFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "autoAssignNewECTicketsFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "autoAssignNewPortalTicketsFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "discussionsLockedFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "timeEntryLockedFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "notifyEmailFrom": {
                        "type": "string",
                        "description": " Max length: 50;"
                    },
                    "notifyEmailFromName": {
                        "type": "string",
                        "description": " Max length: 60;"
                    },
                    "closedLoopDiscussionsFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "closedLoopResolutionFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "closedLoopInternalAnalysisFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "timeEntryDiscussionFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "timeEntryResolutionFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "timeEntryInternalAnalysisFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "problemSort": {
                        "enum": [
                            "Ascending",
                            "Descending"
                        ],
                        "type": "string",
                        "nullable": true
                    },
                    "resolutionSort": {
                        "enum": [
                            "Ascending",
                            "Descending"
                        ],
                        "type": "string",
                        "nullable": true
                    },
                    "internalAnalysisSort": {
                        "enum": [
                            "Ascending",
                            "Descending"
                        ],
                        "type": "string",
                        "nullable": true
                    },
                    "emailConnectorAllowReopenClosedFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "emailConnectorReopenStatus": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "nullable": true
                            },
                            "name": {
                                "type": "string"
                            },
                            "_info": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "emailConnectorReopenResourcesFlag": {
                        "type": "boolean",
                        "description": "This field can only be set when emailConnectorAllowReopenClosed is true",
                        "nullable": true
                    },
                    "emailConnectorNewTicketNoMatchFlag": {
                        "type": "boolean",
                        "description": "This field can only be set when emailConnectorAllowReopenClosed is true",
                        "nullable": true
                    },
                    "emailConnectorNeverReopenByDaysFlag": {
                        "type": "boolean",
                        "description": "This field can only be set when emailConnectorAllowReopenClosed is true",
                        "nullable": true
                    },
                    "emailConnectorReopenDaysLimit": {
                        "type": "integer",
                        "description": "This field can only be set when emailConnectorNeverReopenByDaysFlag and emailConnectorAllowReopenClosed are both true\n            This field is required when emailConnectorNeverReopenByDaysFlag is true",
                        "nullable": true
                    },
                    "emailConnectorNeverReopenByDaysClosedFlag": {
                        "type": "boolean",
                        "description": "This field can only be set when emailConnectorAllowReopenClosed is true",
                        "nullable": true
                    },
                    "emailConnectorReopenDaysClosedLimit": {
                        "type": "integer",
                        "description": "This field can only be set when emailConnectorNeverReopenByDaysClosedFlag and emailConnectorAllowReopenClosed are both true\n            This field is required when emailConnectorNeverReopenByDaysClosedFlag is true",
                        "nullable": true
                    },
                    "useMemberDisplayNameFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "sendToCCFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "autoAssignTicketOwnerFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "closedLoopAllFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "percentageCalculation": {
                        "enum": [
                            "ActualHours",
                            "Manual",
                            "ClosedPhases",
                            "ClosedTickets"
                        ],
                        "type": "string",
                        "nullable": true
                    },
                    "allSort": {
                        "enum": [
                            "Ascending",
                            "Descending"
                        ],
                        "type": "string",
                        "nullable": true
                    },
                    "markFirstNoteIssueFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "restrictBoardByDefaultFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "_info": {
                        "type": "object",
                        "additionalProperties": {
                            "type": "string"
                        }
                    }
                }
            }
        }
    }],

    objectOutputOptions: [{
            "label": "Id",
            "value": "id"
        },
        {
            "label": "Name",
            "value": "name"
        },
        {
            "label": "Location",
            "value": "location"
        },
        {
            "label": "Location Id",
            "value": "location.id"
        },
        {
            "label": "Location Name",
            "value": "location.name"
        },
        {
            "label": "Location Info",
            "value": "location._info"
        },
        {
            "label": "Department",
            "value": "department"
        },
        {
            "label": "Department Id",
            "value": "department.id"
        },
        {
            "label": "Department Identifier",
            "value": "department.identifier"
        },
        {
            "label": "Department Name",
            "value": "department.name"
        },
        {
            "label": "Department Info",
            "value": "department._info"
        },
        {
            "label": "Inactive Flag",
            "value": "inactiveFlag"
        },
        {
            "label": "Sign Off Template",
            "value": "signOffTemplate"
        },
        {
            "label": "Sign Off Template Id",
            "value": "signOffTemplate.id"
        },
        {
            "label": "Sign Off Template Name",
            "value": "signOffTemplate.name"
        },
        {
            "label": "Sign Off Template Info",
            "value": "signOffTemplate._info"
        },
        {
            "label": "Send To Contact Flag",
            "value": "sendToContactFlag"
        },
        {
            "label": "Contact Template",
            "value": "contactTemplate"
        },
        {
            "label": "Contact Template Id",
            "value": "contactTemplate.id"
        },
        {
            "label": "Contact Template Identifier",
            "value": "contactTemplate.identifier"
        },
        {
            "label": "Contact Template Name",
            "value": "contactTemplate.name"
        },
        {
            "label": "Contact Template Type",
            "value": "contactTemplate.type"
        },
        {
            "label": "Contact Template Info",
            "value": "contactTemplate._info"
        },
        {
            "label": "Send To Resource Flag",
            "value": "sendToResourceFlag"
        },
        {
            "label": "Resource Template",
            "value": "resourceTemplate"
        },
        {
            "label": "Resource Template Id",
            "value": "resourceTemplate.id"
        },
        {
            "label": "Resource Template Identifier",
            "value": "resourceTemplate.identifier"
        },
        {
            "label": "Resource Template Name",
            "value": "resourceTemplate.name"
        },
        {
            "label": "Resource Template Type",
            "value": "resourceTemplate.type"
        },
        {
            "label": "Resource Template Info",
            "value": "resourceTemplate._info"
        },
        {
            "label": "Project Flag",
            "value": "projectFlag"
        },
        {
            "label": "Show Dependencies Flag",
            "value": "showDependenciesFlag"
        },
        {
            "label": "Show Estimates Flag",
            "value": "showEstimatesFlag"
        },
        {
            "label": "Board Icon",
            "value": "boardIcon"
        },
        {
            "label": "Board Icon Id",
            "value": "boardIcon.id"
        },
        {
            "label": "Board Icon Name",
            "value": "boardIcon.name"
        },
        {
            "label": "Board Icon Info",
            "value": "boardIcon._info"
        },
        {
            "label": "Bill Tickets After Closed Flag",
            "value": "billTicketsAfterClosedFlag"
        },
        {
            "label": "Bill Ticket Separately Flag",
            "value": "billTicketSeparatelyFlag"
        },
        {
            "label": "Bill Unapproved Time Expense Flag",
            "value": "billUnapprovedTimeExpenseFlag"
        },
        {
            "label": "Override Billing Setup Flag",
            "value": "overrideBillingSetupFlag"
        },
        {
            "label": "Dispatch Member",
            "value": "dispatchMember"
        },
        {
            "label": "Dispatch Member Id",
            "value": "dispatchMember.id"
        },
        {
            "label": "Dispatch Member Identifier",
            "value": "dispatchMember.identifier"
        },
        {
            "label": "Dispatch Member Name",
            "value": "dispatchMember.name"
        },
        {
            "label": "Dispatch Member Info",
            "value": "dispatchMember._info"
        },
        {
            "label": "Service Manager Member",
            "value": "serviceManagerMember"
        },
        {
            "label": "Service Manager Member Id",
            "value": "serviceManagerMember.id"
        },
        {
            "label": "Service Manager Member Identifier",
            "value": "serviceManagerMember.identifier"
        },
        {
            "label": "Service Manager Member Name",
            "value": "serviceManagerMember.name"
        },
        {
            "label": "Service Manager Member Info",
            "value": "serviceManagerMember._info"
        },
        {
            "label": "Duty Manager Member",
            "value": "dutyManagerMember"
        },
        {
            "label": "Duty Manager Member Id",
            "value": "dutyManagerMember.id"
        },
        {
            "label": "Duty Manager Member Identifier",
            "value": "dutyManagerMember.identifier"
        },
        {
            "label": "Duty Manager Member Name",
            "value": "dutyManagerMember.name"
        },
        {
            "label": "Duty Manager Member Info",
            "value": "dutyManagerMember._info"
        },
        {
            "label": "Oncall Member",
            "value": "oncallMember"
        },
        {
            "label": "Oncall Member Id",
            "value": "oncallMember.id"
        },
        {
            "label": "Oncall Member Identifier",
            "value": "oncallMember.identifier"
        },
        {
            "label": "Oncall Member Name",
            "value": "oncallMember.name"
        },
        {
            "label": "Oncall Member Info",
            "value": "oncallMember._info"
        },
        {
            "label": "Work Role",
            "value": "workRole"
        },
        {
            "label": "Work Role Id",
            "value": "workRole.id"
        },
        {
            "label": "Work Role Name",
            "value": "workRole.name"
        },
        {
            "label": "Work Role Info",
            "value": "workRole._info"
        },
        {
            "label": "Work Type",
            "value": "workType"
        },
        {
            "label": "Work Type Id",
            "value": "workType.id"
        },
        {
            "label": "Work Type Name",
            "value": "workType.name"
        },
        {
            "label": "Work Type Info",
            "value": "workType._info"
        },
        {
            "label": "Bill Time",
            "value": "billTime"
        },
        {
            "label": "Bill Expense",
            "value": "billExpense"
        },
        {
            "label": "Bill Product",
            "value": "billProduct"
        },
        {
            "label": "Auto Close Status",
            "value": "autoCloseStatus"
        },
        {
            "label": "Auto Close Status Id",
            "value": "autoCloseStatus.id"
        },
        {
            "label": "Auto Close Status Name",
            "value": "autoCloseStatus.name"
        },
        {
            "label": "Auto Close Status Info",
            "value": "autoCloseStatus._info"
        },
        {
            "label": "Auto Assign New Tickets Flag",
            "value": "autoAssignNewTicketsFlag"
        },
        {
            "label": "Auto Assign New EC Tickets Flag",
            "value": "autoAssignNewECTicketsFlag"
        },
        {
            "label": "Auto Assign New Portal Tickets Flag",
            "value": "autoAssignNewPortalTicketsFlag"
        },
        {
            "label": "Discussions Locked Flag",
            "value": "discussionsLockedFlag"
        },
        {
            "label": "Time Entry Locked Flag",
            "value": "timeEntryLockedFlag"
        },
        {
            "label": "Notify Email From",
            "value": "notifyEmailFrom"
        },
        {
            "label": "Notify Email From Name",
            "value": "notifyEmailFromName"
        },
        {
            "label": "Closed Loop Discussions Flag",
            "value": "closedLoopDiscussionsFlag"
        },
        {
            "label": "Closed Loop Resolution Flag",
            "value": "closedLoopResolutionFlag"
        },
        {
            "label": "Closed Loop Internal Analysis Flag",
            "value": "closedLoopInternalAnalysisFlag"
        },
        {
            "label": "Time Entry Discussion Flag",
            "value": "timeEntryDiscussionFlag"
        },
        {
            "label": "Time Entry Resolution Flag",
            "value": "timeEntryResolutionFlag"
        },
        {
            "label": "Time Entry Internal Analysis Flag",
            "value": "timeEntryInternalAnalysisFlag"
        },
        {
            "label": "Problem Sort",
            "value": "problemSort"
        },
        {
            "label": "Resolution Sort",
            "value": "resolutionSort"
        },
        {
            "label": "Internal Analysis Sort",
            "value": "internalAnalysisSort"
        },
        {
            "label": "Email Connector Allow Reopen Closed Flag",
            "value": "emailConnectorAllowReopenClosedFlag"
        },
        {
            "label": "Email Connector Reopen Status",
            "value": "emailConnectorReopenStatus"
        },
        {
            "label": "Email Connector Reopen Status Id",
            "value": "emailConnectorReopenStatus.id"
        },
        {
            "label": "Email Connector Reopen Status Name",
            "value": "emailConnectorReopenStatus.name"
        },
        {
            "label": "Email Connector Reopen Status Info",
            "value": "emailConnectorReopenStatus._info"
        },
        {
            "label": "Email Connector Reopen Resources Flag",
            "value": "emailConnectorReopenResourcesFlag"
        },
        {
            "label": "Email Connector New Ticket No Match Flag",
            "value": "emailConnectorNewTicketNoMatchFlag"
        },
        {
            "label": "Email Connector Never Reopen By Days Flag",
            "value": "emailConnectorNeverReopenByDaysFlag"
        },
        {
            "label": "Email Connector Reopen Days Limit",
            "value": "emailConnectorReopenDaysLimit"
        },
        {
            "label": "Email Connector Never Reopen By Days Closed Flag",
            "value": "emailConnectorNeverReopenByDaysClosedFlag"
        },
        {
            "label": "Email Connector Reopen Days Closed Limit",
            "value": "emailConnectorReopenDaysClosedLimit"
        },
        {
            "label": "Use Member Display Name Flag",
            "value": "useMemberDisplayNameFlag"
        },
        {
            "label": "Send To CC Flag",
            "value": "sendToCCFlag"
        },
        {
            "label": "Auto Assign Ticket Owner Flag",
            "value": "autoAssignTicketOwnerFlag"
        },
        {
            "label": "Closed Loop All Flag",
            "value": "closedLoopAllFlag"
        },
        {
            "label": "Percentage Calculation",
            "value": "percentageCalculation"
        },
        {
            "label": "All Sort",
            "value": "allSort"
        },
        {
            "label": "Mark First Note Issue Flag",
            "value": "markFirstNoteIssueFlag"
        },
        {
            "label": "Restrict Board By Default Flag",
            "value": "restrictBoardByDefaultFlag"
        },
        {
            "label": "Info",
            "value": "_info"
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