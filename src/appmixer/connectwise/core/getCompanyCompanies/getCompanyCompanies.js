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

        let url = this.getBaseUrl(context) + `/company/companies`;

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
                    "identifier",
                    "name"
                ],
                "type": "object",
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "identifier": {
                        "type": "string",
                        "description": " Max length: 25;"
                    },
                    "name": {
                        "type": "string",
                        "description": " Max length: 50;"
                    },
                    "status": {
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
                    "addressLine1": {
                        "type": "string",
                        "description": "At least one address field is required -- addressLine1, addressLine2, city, state, zip and/or country Max length: 50;"
                    },
                    "addressLine2": {
                        "type": "string",
                        "description": "At least one address field is required -- addressLine1, addressLine2, city, state, zip and/or country Max length: 50;"
                    },
                    "city": {
                        "type": "string",
                        "description": "At least one address field is required -- addressLine1, addressLine2, city, state, zip and/or country Max length: 50;"
                    },
                    "state": {
                        "type": "string",
                        "description": "At least one address field is required -- addressLine1, addressLine2, city, state, zip and/or country Max length: 50;"
                    },
                    "zip": {
                        "type": "string",
                        "description": "At least one address field is required -- addressLine1, addressLine2, city, state, zip and/or country Max length: 12;"
                    },
                    "country": {
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
                    "phoneNumber": {
                        "type": "string",
                        "description": " Max length: 30;"
                    },
                    "faxNumber": {
                        "type": "string",
                        "description": " Max length: 30;"
                    },
                    "website": {
                        "type": "string",
                        "description": " Max length: 255;"
                    },
                    "territory": {
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
                    "market": {
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
                    "accountNumber": {
                        "type": "string"
                    },
                    "defaultContact": {
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
                    "dateAcquired": {
                        "type": "string",
                        "format": "date-time"
                    },
                    "sicCode": {
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
                    "parentCompany": {
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
                    "annualRevenue": {
                        "type": "number",
                        "nullable": true
                    },
                    "numberOfEmployees": {
                        "type": "integer",
                        "nullable": true
                    },
                    "yearEstablished": {
                        "type": "integer",
                        "nullable": true
                    },
                    "revenueYear": {
                        "type": "integer",
                        "nullable": true
                    },
                    "ownershipType": {
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
                    "timeZoneSetup": {
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
                    "leadSource": {
                        "type": "string",
                        "description": " Max length: 50;"
                    },
                    "leadFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "unsubscribeFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "calendar": {
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
                    "userDefinedField1": {
                        "type": "string",
                        "description": " Max length: 50;"
                    },
                    "userDefinedField2": {
                        "type": "string",
                        "description": " Max length: 50;"
                    },
                    "userDefinedField3": {
                        "type": "string",
                        "description": " Max length: 50;"
                    },
                    "userDefinedField4": {
                        "type": "string",
                        "description": " Max length: 50;"
                    },
                    "userDefinedField5": {
                        "type": "string",
                        "description": " Max length: 50;"
                    },
                    "userDefinedField6": {
                        "type": "string",
                        "description": " Max length: 50;"
                    },
                    "userDefinedField7": {
                        "type": "string",
                        "description": " Max length: 50;"
                    },
                    "userDefinedField8": {
                        "type": "string",
                        "description": " Max length: 50;"
                    },
                    "userDefinedField9": {
                        "type": "string",
                        "description": " Max length: 50;"
                    },
                    "userDefinedField10": {
                        "type": "string",
                        "description": " Max length: 50;"
                    },
                    "vendorIdentifier": {
                        "type": "string"
                    },
                    "taxIdentifier": {
                        "type": "string"
                    },
                    "taxCode": {
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
                    "billingTerms": {
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
                    "invoiceTemplate": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "description": "Invoice Template Setup Id",
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
                    "pricingSchedule": {
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
                    "companyEntityType": {
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
                    "billToCompany": {
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
                    "billingSite": {
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
                    "billingContact": {
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
                    "invoiceDeliveryMethod": {
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
                    "invoiceToEmailAddress": {
                        "type": "string"
                    },
                    "invoiceCCEmailAddress": {
                        "type": "string"
                    },
                    "deletedFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "dateDeleted": {
                        "type": "string",
                        "format": "date-time"
                    },
                    "deletedBy": {
                        "type": "string"
                    },
                    "mobileGuid": {
                        "type": "string",
                        "format": "uuid",
                        "nullable": true
                    },
                    "facebookUrl": {
                        "type": "string"
                    },
                    "twitterUrl": {
                        "type": "string"
                    },
                    "linkedInUrl": {
                        "type": "string"
                    },
                    "currency": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "nullable": true
                            },
                            "symbol": {
                                "type": "string"
                            },
                            "currencyCode": {
                                "type": "string"
                            },
                            "decimalSeparator": {
                                "type": "string"
                            },
                            "numberOfDecimals": {
                                "type": "integer"
                            },
                            "thousandsSeparator": {
                                "type": "string"
                            },
                            "negativeParenthesesFlag": {
                                "type": "boolean"
                            },
                            "displaySymbolFlag": {
                                "type": "boolean"
                            },
                            "currencyIdentifier": {
                                "type": "string"
                            },
                            "displayIdFlag": {
                                "type": "boolean"
                            },
                            "rightAlign": {
                                "type": "boolean"
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
                    "territoryManager": {
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
                    "resellerIdentifier": {
                        "type": "string"
                    },
                    "isVendorFlag": {
                        "type": "boolean",
                        "nullable": true
                    },
                    "types": {
                        "type": "array",
                        "items": {
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
                        "description": "Integrer array of Company_Type_Recids to be assigned to company that can be passed in only during new company creation (post)\n            To update existing companies type, use the /company/companyTypeAssociations or /company/companies/{ID}/typeAssociations endpoints"
                    },
                    "site": {
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
                    "integratorTags": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        }
                    },
                    "_info": {
                        "type": "object",
                        "additionalProperties": {
                            "type": "string"
                        }
                    },
                    "customFields": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {
                                    "type": "integer",
                                    "nullable": true
                                },
                                "caption": {
                                    "type": "string"
                                },
                                "type": {
                                    "enum": [
                                        "TextArea",
                                        "Button",
                                        "Currency",
                                        "Date",
                                        "Hyperlink",
                                        "IPAddress",
                                        "Checkbox",
                                        "Number",
                                        "Percent",
                                        "Text",
                                        "Password"
                                    ],
                                    "type": "string",
                                    "nullable": true
                                },
                                "entryMethod": {
                                    "enum": [
                                        "Date",
                                        "EntryField",
                                        "List",
                                        "Option"
                                    ],
                                    "type": "string",
                                    "nullable": true
                                },
                                "numberOfDecimals": {
                                    "type": "integer",
                                    "nullable": true
                                },
                                "value": {
                                    "type": "object"
                                }
                            }
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
            "label": "Identifier",
            "value": "identifier"
        },
        {
            "label": "Name",
            "value": "name"
        },
        {
            "label": "Status",
            "value": "status"
        },
        {
            "label": "Status Id",
            "value": "status.id"
        },
        {
            "label": "Status Name",
            "value": "status.name"
        },
        {
            "label": "Status Info",
            "value": "status._info"
        },
        {
            "label": "Address Line 1",
            "value": "addressLine1"
        },
        {
            "label": "Address Line 2",
            "value": "addressLine2"
        },
        {
            "label": "City",
            "value": "city"
        },
        {
            "label": "State",
            "value": "state"
        },
        {
            "label": "Zip",
            "value": "zip"
        },
        {
            "label": "Country",
            "value": "country"
        },
        {
            "label": "Country Id",
            "value": "country.id"
        },
        {
            "label": "Country Identifier",
            "value": "country.identifier"
        },
        {
            "label": "Country Name",
            "value": "country.name"
        },
        {
            "label": "Country Info",
            "value": "country._info"
        },
        {
            "label": "Phone Number",
            "value": "phoneNumber"
        },
        {
            "label": "Fax Number",
            "value": "faxNumber"
        },
        {
            "label": "Website",
            "value": "website"
        },
        {
            "label": "Territory",
            "value": "territory"
        },
        {
            "label": "Territory Id",
            "value": "territory.id"
        },
        {
            "label": "Territory Name",
            "value": "territory.name"
        },
        {
            "label": "Territory Info",
            "value": "territory._info"
        },
        {
            "label": "Market",
            "value": "market"
        },
        {
            "label": "Market Id",
            "value": "market.id"
        },
        {
            "label": "Market Name",
            "value": "market.name"
        },
        {
            "label": "Market Info",
            "value": "market._info"
        },
        {
            "label": "Account Number",
            "value": "accountNumber"
        },
        {
            "label": "Default Contact",
            "value": "defaultContact"
        },
        {
            "label": "Default Contact Id",
            "value": "defaultContact.id"
        },
        {
            "label": "Default Contact Name",
            "value": "defaultContact.name"
        },
        {
            "label": "Default Contact Info",
            "value": "defaultContact._info"
        },
        {
            "label": "Date Acquired",
            "value": "dateAcquired"
        },
        {
            "label": "Sic Code",
            "value": "sicCode"
        },
        {
            "label": "Sic Code Id",
            "value": "sicCode.id"
        },
        {
            "label": "Sic Code Name",
            "value": "sicCode.name"
        },
        {
            "label": "Sic Code Info",
            "value": "sicCode._info"
        },
        {
            "label": "Parent Company",
            "value": "parentCompany"
        },
        {
            "label": "Parent Company Id",
            "value": "parentCompany.id"
        },
        {
            "label": "Parent Company Identifier",
            "value": "parentCompany.identifier"
        },
        {
            "label": "Parent Company Name",
            "value": "parentCompany.name"
        },
        {
            "label": "Parent Company Info",
            "value": "parentCompany._info"
        },
        {
            "label": "Annual Revenue",
            "value": "annualRevenue"
        },
        {
            "label": "Number Of Employees",
            "value": "numberOfEmployees"
        },
        {
            "label": "Year Established",
            "value": "yearEstablished"
        },
        {
            "label": "Revenue Year",
            "value": "revenueYear"
        },
        {
            "label": "Ownership Type",
            "value": "ownershipType"
        },
        {
            "label": "Ownership Type Id",
            "value": "ownershipType.id"
        },
        {
            "label": "Ownership Type Name",
            "value": "ownershipType.name"
        },
        {
            "label": "Ownership Type Info",
            "value": "ownershipType._info"
        },
        {
            "label": "Time Zone Setup",
            "value": "timeZoneSetup"
        },
        {
            "label": "Time Zone Setup Id",
            "value": "timeZoneSetup.id"
        },
        {
            "label": "Time Zone Setup Name",
            "value": "timeZoneSetup.name"
        },
        {
            "label": "Time Zone Setup Info",
            "value": "timeZoneSetup._info"
        },
        {
            "label": "Lead Source",
            "value": "leadSource"
        },
        {
            "label": "Lead Flag",
            "value": "leadFlag"
        },
        {
            "label": "Unsubscribe Flag",
            "value": "unsubscribeFlag"
        },
        {
            "label": "Calendar",
            "value": "calendar"
        },
        {
            "label": "Calendar Id",
            "value": "calendar.id"
        },
        {
            "label": "Calendar Name",
            "value": "calendar.name"
        },
        {
            "label": "Calendar Info",
            "value": "calendar._info"
        },
        {
            "label": "User Defined Field 1",
            "value": "userDefinedField1"
        },
        {
            "label": "User Defined Field 2",
            "value": "userDefinedField2"
        },
        {
            "label": "User Defined Field 3",
            "value": "userDefinedField3"
        },
        {
            "label": "User Defined Field 4",
            "value": "userDefinedField4"
        },
        {
            "label": "User Defined Field 5",
            "value": "userDefinedField5"
        },
        {
            "label": "User Defined Field 6",
            "value": "userDefinedField6"
        },
        {
            "label": "User Defined Field 7",
            "value": "userDefinedField7"
        },
        {
            "label": "User Defined Field 8",
            "value": "userDefinedField8"
        },
        {
            "label": "User Defined Field 9",
            "value": "userDefinedField9"
        },
        {
            "label": "User Defined Field 10",
            "value": "userDefinedField10"
        },
        {
            "label": "Vendor Identifier",
            "value": "vendorIdentifier"
        },
        {
            "label": "Tax Identifier",
            "value": "taxIdentifier"
        },
        {
            "label": "Tax Code",
            "value": "taxCode"
        },
        {
            "label": "Tax Code Id",
            "value": "taxCode.id"
        },
        {
            "label": "Tax Code Name",
            "value": "taxCode.name"
        },
        {
            "label": "Tax Code Info",
            "value": "taxCode._info"
        },
        {
            "label": "Billing Terms",
            "value": "billingTerms"
        },
        {
            "label": "Billing Terms Id",
            "value": "billingTerms.id"
        },
        {
            "label": "Billing Terms Name",
            "value": "billingTerms.name"
        },
        {
            "label": "Billing Terms Info",
            "value": "billingTerms._info"
        },
        {
            "label": "Invoice Template",
            "value": "invoiceTemplate"
        },
        {
            "label": "Invoice Template Id",
            "value": "invoiceTemplate.id"
        },
        {
            "label": "Invoice Template Name",
            "value": "invoiceTemplate.name"
        },
        {
            "label": "Invoice Template Info",
            "value": "invoiceTemplate._info"
        },
        {
            "label": "Pricing Schedule",
            "value": "pricingSchedule"
        },
        {
            "label": "Pricing Schedule Id",
            "value": "pricingSchedule.id"
        },
        {
            "label": "Pricing Schedule Name",
            "value": "pricingSchedule.name"
        },
        {
            "label": "Pricing Schedule Info",
            "value": "pricingSchedule._info"
        },
        {
            "label": "Company Entity Type",
            "value": "companyEntityType"
        },
        {
            "label": "Company Entity Type Id",
            "value": "companyEntityType.id"
        },
        {
            "label": "Company Entity Type Name",
            "value": "companyEntityType.name"
        },
        {
            "label": "Company Entity Type Info",
            "value": "companyEntityType._info"
        },
        {
            "label": "Bill To Company",
            "value": "billToCompany"
        },
        {
            "label": "Bill To Company Id",
            "value": "billToCompany.id"
        },
        {
            "label": "Bill To Company Identifier",
            "value": "billToCompany.identifier"
        },
        {
            "label": "Bill To Company Name",
            "value": "billToCompany.name"
        },
        {
            "label": "Bill To Company Info",
            "value": "billToCompany._info"
        },
        {
            "label": "Billing Site",
            "value": "billingSite"
        },
        {
            "label": "Billing Site Id",
            "value": "billingSite.id"
        },
        {
            "label": "Billing Site Name",
            "value": "billingSite.name"
        },
        {
            "label": "Billing Site Info",
            "value": "billingSite._info"
        },
        {
            "label": "Billing Contact",
            "value": "billingContact"
        },
        {
            "label": "Billing Contact Id",
            "value": "billingContact.id"
        },
        {
            "label": "Billing Contact Name",
            "value": "billingContact.name"
        },
        {
            "label": "Billing Contact Info",
            "value": "billingContact._info"
        },
        {
            "label": "Invoice Delivery Method",
            "value": "invoiceDeliveryMethod"
        },
        {
            "label": "Invoice Delivery Method Id",
            "value": "invoiceDeliveryMethod.id"
        },
        {
            "label": "Invoice Delivery Method Name",
            "value": "invoiceDeliveryMethod.name"
        },
        {
            "label": "Invoice Delivery Method Info",
            "value": "invoiceDeliveryMethod._info"
        },
        {
            "label": "Invoice To Email Address",
            "value": "invoiceToEmailAddress"
        },
        {
            "label": "Invoice CC Email Address",
            "value": "invoiceCCEmailAddress"
        },
        {
            "label": "Deleted Flag",
            "value": "deletedFlag"
        },
        {
            "label": "Date Deleted",
            "value": "dateDeleted"
        },
        {
            "label": "Deleted By",
            "value": "deletedBy"
        },
        {
            "label": "Mobile Guid",
            "value": "mobileGuid"
        },
        {
            "label": "Facebook Url",
            "value": "facebookUrl"
        },
        {
            "label": "Twitter Url",
            "value": "twitterUrl"
        },
        {
            "label": "Linked In Url",
            "value": "linkedInUrl"
        },
        {
            "label": "Currency",
            "value": "currency"
        },
        {
            "label": "Currency Id",
            "value": "currency.id"
        },
        {
            "label": "Currency Symbol",
            "value": "currency.symbol"
        },
        {
            "label": "Currency Currency Code",
            "value": "currency.currencyCode"
        },
        {
            "label": "Currency Decimal Separator",
            "value": "currency.decimalSeparator"
        },
        {
            "label": "Currency Number Of Decimals",
            "value": "currency.numberOfDecimals"
        },
        {
            "label": "Currency Thousands Separator",
            "value": "currency.thousandsSeparator"
        },
        {
            "label": "Currency Negative Parentheses Flag",
            "value": "currency.negativeParenthesesFlag"
        },
        {
            "label": "Currency Display Symbol Flag",
            "value": "currency.displaySymbolFlag"
        },
        {
            "label": "Currency Currency Identifier",
            "value": "currency.currencyIdentifier"
        },
        {
            "label": "Currency Display Id Flag",
            "value": "currency.displayIdFlag"
        },
        {
            "label": "Currency Right Align",
            "value": "currency.rightAlign"
        },
        {
            "label": "Currency Name",
            "value": "currency.name"
        },
        {
            "label": "Currency Info",
            "value": "currency._info"
        },
        {
            "label": "Territory Manager",
            "value": "territoryManager"
        },
        {
            "label": "Territory Manager Id",
            "value": "territoryManager.id"
        },
        {
            "label": "Territory Manager Identifier",
            "value": "territoryManager.identifier"
        },
        {
            "label": "Territory Manager Name",
            "value": "territoryManager.name"
        },
        {
            "label": "Territory Manager Info",
            "value": "territoryManager._info"
        },
        {
            "label": "Reseller Identifier",
            "value": "resellerIdentifier"
        },
        {
            "label": "Is Vendor Flag",
            "value": "isVendorFlag"
        },
        {
            "label": "Types",
            "value": "types",
            "schema": {
                "type": "array",
                "items": {
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
                "description": "Integrer array of Company_Type_Recids to be assigned to company that can be passed in only during new company creation (post)\n            To update existing companies type, use the /company/companyTypeAssociations or /company/companies/{ID}/typeAssociations endpoints"
            }
        },
        {
            "label": "Site",
            "value": "site"
        },
        {
            "label": "Site Id",
            "value": "site.id"
        },
        {
            "label": "Site Name",
            "value": "site.name"
        },
        {
            "label": "Site Info",
            "value": "site._info"
        },
        {
            "label": "Integrator Tags",
            "value": "integratorTags",
            "schema": {
                "type": "array",
                "items": {
                    "type": "string"
                }
            }
        },
        {
            "label": "Info",
            "value": "_info"
        },
        {
            "label": "Custom Fields",
            "value": "customFields",
            "schema": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "integer",
                            "nullable": true
                        },
                        "caption": {
                            "type": "string"
                        },
                        "type": {
                            "enum": [
                                "TextArea",
                                "Button",
                                "Currency",
                                "Date",
                                "Hyperlink",
                                "IPAddress",
                                "Checkbox",
                                "Number",
                                "Percent",
                                "Text",
                                "Password"
                            ],
                            "type": "string",
                            "nullable": true
                        },
                        "entryMethod": {
                            "enum": [
                                "Date",
                                "EntryField",
                                "List",
                                "Option"
                            ],
                            "type": "string",
                            "nullable": true
                        },
                        "numberOfDecimals": {
                            "type": "integer",
                            "nullable": true
                        },
                        "value": {
                            "type": "object"
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