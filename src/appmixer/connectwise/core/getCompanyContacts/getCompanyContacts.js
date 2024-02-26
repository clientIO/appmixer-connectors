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

        let url = this.getBaseUrl(context) + '/company/contacts';

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
        'label': 'Result',
        'value': 'result',
        'schema': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'id': {
                        'type': 'integer'
                    },
                    'firstName': {
                        'type': 'string'
                    },
                    'lastName': {
                        'type': 'string'
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
                    'addressLine1': {
                        'type': 'string'
                    },
                    'addressLine2': {
                        'type': 'string'
                    },
                    'city': {
                        'type': 'string'
                    },
                    'state': {
                        'type': 'string'
                    },
                    'zip': {
                        'type': 'string'
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
                    'relationship': {
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
                    'relationshipOverride': {
                        'type': 'string'
                    },
                    'department': {
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
                    'inactiveFlag': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'defaultMergeContactId': {
                        'type': 'integer',
                        'nullable': true
                    },
                    'securityIdentifier': {
                        'type': 'string'
                    },
                    'managerContact': {
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
                    'assistantContact': {
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
                    'title': {
                        'type': 'string'
                    },
                    'school': {
                        'type': 'string'
                    },
                    'nickName': {
                        'type': 'string'
                    },
                    'marriedFlag': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'childrenFlag': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'children': {
                        'type': 'string'
                    },
                    'significantOther': {
                        'type': 'string'
                    },
                    'portalPassword': {
                        'type': 'string'
                    },
                    'portalSecurityLevel': {
                        'type': 'integer',
                        'nullable': true
                    },
                    'disablePortalLoginFlag': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'unsubscribeFlag': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'gender': {
                        'enum': [
                            'Female',
                            'Male'
                        ],
                        'type': 'string',
                        'nullable': true
                    },
                    'birthDay': {
                        'type': 'string'
                    },
                    'anniversary': {
                        'type': 'string'
                    },
                    'presence': {
                        'enum': [
                            'NoAgent',
                            'Online',
                            'DoNotDisturb',
                            'Away',
                            'Offline'
                        ],
                        'type': 'string',
                        'nullable': true
                    },
                    'mobileGuid': {
                        'type': 'string',
                        'format': 'uuid',
                        'nullable': true
                    },
                    'facebookUrl': {
                        'type': 'string'
                    },
                    'twitterUrl': {
                        'type': 'string'
                    },
                    'linkedInUrl': {
                        'type': 'string'
                    },
                    'defaultPhoneType': {
                        'type': 'string'
                    },
                    'defaultPhoneNbr': {
                        'type': 'string'
                    },
                    'defaultPhoneExtension': {
                        'type': 'string'
                    },
                    'defaultBillingFlag': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'defaultFlag': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'userDefinedField1': {
                        'type': 'string',
                        'description': ' Max length: 50;'
                    },
                    'userDefinedField2': {
                        'type': 'string',
                        'description': ' Max length: 50;'
                    },
                    'userDefinedField3': {
                        'type': 'string',
                        'description': ' Max length: 50;'
                    },
                    'userDefinedField4': {
                        'type': 'string',
                        'description': ' Max length: 50;'
                    },
                    'userDefinedField5': {
                        'type': 'string',
                        'description': ' Max length: 50;'
                    },
                    'userDefinedField6': {
                        'type': 'string',
                        'description': ' Max length: 50;'
                    },
                    'userDefinedField7': {
                        'type': 'string',
                        'description': ' Max length: 50;'
                    },
                    'userDefinedField8': {
                        'type': 'string',
                        'description': ' Max length: 50;'
                    },
                    'userDefinedField9': {
                        'type': 'string',
                        'description': ' Max length: 50;'
                    },
                    'userDefinedField10': {
                        'type': 'string',
                        'description': ' Max length: 50;'
                    },
                    'companyLocation': {
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
                    'communicationItems': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'id': {
                                    'type': 'integer'
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
                                'value': {
                                    'type': 'string'
                                },
                                'extension': {
                                    'type': 'string'
                                },
                                'defaultFlag': {
                                    'type': 'boolean',
                                    'nullable': true
                                },
                                'domain': {
                                    'type': 'string'
                                },
                                'communicationType': {
                                    'enum': [
                                        'Email',
                                        'Fax',
                                        'Phone'
                                    ],
                                    'type': 'string',
                                    'nullable': true
                                }
                            }
                        }
                    },
                    'types': {
                        'type': 'array',
                        'items': {
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
                        }
                    },
                    'integratorTags': {
                        'type': 'array',
                        'items': {
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
                    },
                    'photo': {
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
                    'ignoreDuplicates': {
                        'type': 'boolean'
                    },
                    '_info': {
                        'type': 'object',
                        'additionalProperties': {
                            'type': 'string'
                        }
                    },
                    'typeIds': {
                        'type': 'array',
                        'items': {
                            'type': 'integer'
                        },
                        // eslint-disable-next-line max-len
                        'description': 'Integrer array of Contact_Type_Recids to be assigned to contact that can be passed in only during new contact creation (post)\n            To update existing contacts type, use the /company/contactTypeAssociations or /company/contacts/{ID}/typeAssociations endpoints'
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
        'label': 'First Name',
        'value': 'firstName'
    },
    {
        'label': 'Last Name',
        'value': 'lastName'
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
        'label': 'State',
        'value': 'state'
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
        'label': 'Relationship',
        'value': 'relationship'
    },
    {
        'label': 'Relationship Id',
        'value': 'relationship.id'
    },
    {
        'label': 'Relationship Name',
        'value': 'relationship.name'
    },
    {
        'label': 'Relationship Info',
        'value': 'relationship._info'
    },
    {
        'label': 'Relationship Override',
        'value': 'relationshipOverride'
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
        'label': 'Department Name',
        'value': 'department.name'
    },
    {
        'label': 'Department Info',
        'value': 'department._info'
    },
    {
        'label': 'Inactive Flag',
        'value': 'inactiveFlag'
    },
    {
        'label': 'Default Merge Contact Id',
        'value': 'defaultMergeContactId'
    },
    {
        'label': 'Security Identifier',
        'value': 'securityIdentifier'
    },
    {
        'label': 'Manager Contact',
        'value': 'managerContact'
    },
    {
        'label': 'Manager Contact Id',
        'value': 'managerContact.id'
    },
    {
        'label': 'Manager Contact Name',
        'value': 'managerContact.name'
    },
    {
        'label': 'Manager Contact Info',
        'value': 'managerContact._info'
    },
    {
        'label': 'Assistant Contact',
        'value': 'assistantContact'
    },
    {
        'label': 'Assistant Contact Id',
        'value': 'assistantContact.id'
    },
    {
        'label': 'Assistant Contact Name',
        'value': 'assistantContact.name'
    },
    {
        'label': 'Assistant Contact Info',
        'value': 'assistantContact._info'
    },
    {
        'label': 'Title',
        'value': 'title'
    },
    {
        'label': 'School',
        'value': 'school'
    },
    {
        'label': 'Nick Name',
        'value': 'nickName'
    },
    {
        'label': 'Married Flag',
        'value': 'marriedFlag'
    },
    {
        'label': 'Children Flag',
        'value': 'childrenFlag'
    },
    {
        'label': 'Children',
        'value': 'children'
    },
    {
        'label': 'Significant Other',
        'value': 'significantOther'
    },
    {
        'label': 'Portal Password',
        'value': 'portalPassword'
    },
    {
        'label': 'Portal Security Level',
        'value': 'portalSecurityLevel'
    },
    {
        'label': 'Disable Portal Login Flag',
        'value': 'disablePortalLoginFlag'
    },
    {
        'label': 'Unsubscribe Flag',
        'value': 'unsubscribeFlag'
    },
    {
        'label': 'Gender',
        'value': 'gender'
    },
    {
        'label': 'Birth Day',
        'value': 'birthDay'
    },
    {
        'label': 'Anniversary',
        'value': 'anniversary'
    },
    {
        'label': 'Presence',
        'value': 'presence'
    },
    {
        'label': 'Mobile Guid',
        'value': 'mobileGuid'
    },
    {
        'label': 'Facebook Url',
        'value': 'facebookUrl'
    },
    {
        'label': 'Twitter Url',
        'value': 'twitterUrl'
    },
    {
        'label': 'Linked In Url',
        'value': 'linkedInUrl'
    },
    {
        'label': 'Default Phone Type',
        'value': 'defaultPhoneType'
    },
    {
        'label': 'Default Phone Nbr',
        'value': 'defaultPhoneNbr'
    },
    {
        'label': 'Default Phone Extension',
        'value': 'defaultPhoneExtension'
    },
    {
        'label': 'Default Billing Flag',
        'value': 'defaultBillingFlag'
    },
    {
        'label': 'Default Flag',
        'value': 'defaultFlag'
    },
    {
        'label': 'User Defined Field 1',
        'value': 'userDefinedField1'
    },
    {
        'label': 'User Defined Field 2',
        'value': 'userDefinedField2'
    },
    {
        'label': 'User Defined Field 3',
        'value': 'userDefinedField3'
    },
    {
        'label': 'User Defined Field 4',
        'value': 'userDefinedField4'
    },
    {
        'label': 'User Defined Field 5',
        'value': 'userDefinedField5'
    },
    {
        'label': 'User Defined Field 6',
        'value': 'userDefinedField6'
    },
    {
        'label': 'User Defined Field 7',
        'value': 'userDefinedField7'
    },
    {
        'label': 'User Defined Field 8',
        'value': 'userDefinedField8'
    },
    {
        'label': 'User Defined Field 9',
        'value': 'userDefinedField9'
    },
    {
        'label': 'User Defined Field 10',
        'value': 'userDefinedField10'
    },
    {
        'label': 'Company Location',
        'value': 'companyLocation'
    },
    {
        'label': 'Company Location Id',
        'value': 'companyLocation.id'
    },
    {
        'label': 'Company Location Name',
        'value': 'companyLocation.name'
    },
    {
        'label': 'Company Location Info',
        'value': 'companyLocation._info'
    },
    {
        'label': 'Communication Items',
        'value': 'communicationItems',
        'schema': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'id': {
                        'type': 'integer'
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
                    'value': {
                        'type': 'string'
                    },
                    'extension': {
                        'type': 'string'
                    },
                    'defaultFlag': {
                        'type': 'boolean',
                        'nullable': true
                    },
                    'domain': {
                        'type': 'string'
                    },
                    'communicationType': {
                        'enum': [
                            'Email',
                            'Fax',
                            'Phone'
                        ],
                        'type': 'string',
                        'nullable': true
                    }
                }
            }
        }
    },
    {
        'label': 'Types',
        'value': 'types',
        'schema': {
            'type': 'array',
            'items': {
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
            }
        }
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
    },
    {
        'label': 'Photo',
        'value': 'photo'
    },
    {
        'label': 'Photo Id',
        'value': 'photo.id'
    },
    {
        'label': 'Photo Name',
        'value': 'photo.name'
    },
    {
        'label': 'Photo Info',
        'value': 'photo._info'
    },
    {
        'label': 'Ignore Duplicates',
        'value': 'ignoreDuplicates'
    },
    {
        'label': 'Info',
        'value': '_info'
    },
    {
        'label': 'Type Ids',
        'value': 'typeIds',
        'schema': {
            'type': 'array',
            'items': {
                'type': 'integer'
            },
            // eslint-disable-next-line max-len
            'description': 'Integrer array of Contact_Type_Recids to be assigned to contact that can be passed in only during new contact creation (post)\n            To update existing contacts type, use the /company/contactTypeAssociations or /company/contacts/{ID}/typeAssociations endpoints'
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
