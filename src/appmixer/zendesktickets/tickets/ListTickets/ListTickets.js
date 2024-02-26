'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.xConnectorOutputType);
        }

        const limit = context.messages.in.content.xConnectorPaginationLimit;
        const { data } = await this.httpRequest(context);
        const resultsExpression = lib.jsonata('tickets');
        const result = (await resultsExpression.evaluate(data)).slice(0, limit);

        if (context.messages.in.content.xConnectorOutputType === 'object') {
            return context.sendArray(result, 'out');
        } else {
            // array
            return context.sendJson({ result }, 'out');
        }
    },

    httpRequest: async function(context, override = {}) {

        // eslint-disable-next-line no-unused-vars
        const input = context.messages.in.content;

        let url = lib.getBaseUrl(context) + '/api/v2/tickets';

        const headers = {};
        const query = new URLSearchParams;

        const queryParameters = { 'external_id': input['external_id'] };

        if (override?.query) {
            Object.keys(override.query).forEach(parameter => {
                queryParameters[parameter] = override.query[parameter];
            });
        }

        Object.keys(queryParameters).forEach(parameter => {
            if (queryParameters[parameter]) {
                query.append(parameter, queryParameters[parameter]);
            }
        });

        headers['Authorization'] = 'Bearer ' + context.auth.accessToken;

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
    },

    getOutputPortOptions: function(context, xConnectorOutputType) {

        if (xConnectorOutputType === 'object') {
            return context.sendJson(this.objectOutputOptions, 'out');
        } else if (xConnectorOutputType === 'array') {
            return context.sendJson(this.arrayOutputOptions, 'out');
        }
    },

    arrayOutputOptions: [
        {
            'label': 'Result',
            'value': 'result',
            'schema': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'example': {
                        'assignee_id': 235323,
                        'collaborator_ids': [
                            35334,
                            234
                        ],
                        'created_at': '2009-07-20T22:55:29Z',
                        'custom_fields': [
                            {
                                'id': 27642,
                                'value': '745'
                            },
                            {
                                'id': 27648,
                                'value': 'yes'
                            }
                        ],
                        'custom_status_id': 123,
                        'description': 'The fire is very colorful.',
                        'due_at': null,
                        'external_id': 'ahg35h3jh',
                        'follower_ids': [
                            35334,
                            234
                        ],
                        'from_messaging_channel': false,
                        'group_id': 98738,
                        'has_incidents': false,
                        'id': 35436,
                        'organization_id': 509974,
                        'priority': 'high',
                        'problem_id': 9873764,
                        'raw_subject': '{{dc.printer_on_fire}}',
                        'recipient': 'support@company.com',
                        'requester_id': 20978392,
                        'satisfaction_rating': {
                            'comment': 'Great support!',
                            'id': 1234,
                            'score': 'good'
                        },
                        'sharing_agreement_ids': [
                            84432
                        ],
                        'status': 'open',
                        'subject': 'Help, my printer is on fire!',
                        'submitter_id': 76872,
                        'tags': [
                            'enterprise',
                            'other_tag'
                        ],
                        'type': 'incident',
                        'updated_at': '2011-05-05T10:38:52Z',
                        'url': 'https://company.zendesk.com/api/v2/tickets/35436.json',
                        'via': {
                            'channel': 'web'
                        }
                    },
                    'required': [
                        'requester_id'
                    ],
                    'properties': {
                        'allow_attachments': {
                            'type': 'boolean',
                            'description': 'Permission for agents to add add attachments to a comment. Defaults to true',
                            'readOnly': true
                        },
                        'allow_channelback': {
                            'type': 'boolean',
                            'description': 'Is false if channelback is disabled, true otherwise. Only applicable for channels framework ticket',
                            'readOnly': true
                        },
                        'assignee_email': {
                            'type': 'string',
                            'description': 'Write only. The email address of the agent to assign the ticket to',
                            'writeOnly': true
                        },
                        'assignee_id': {
                            'type': 'integer',
                            'description': 'The agent currently assigned to the ticket'
                        },
                        'attribute_value_ids': {
                            'type': 'array',
                            'description': 'Write only. An array of the IDs of attribute values to be associated with the ticket',
                            'writeOnly': true
                        },
                        'brand_id': {
                            'type': 'integer',
                            'description': 'Enterprise only. The id of the brand this ticket is associated with'
                        },
                        'collaborator_ids': {
                            'type': 'array',
                            'description': "The ids of users currently CC'ed on the ticket"
                        },
                        'collaborators': {
                            'type': 'array',
                            'description': "POST requests only. Users to add as cc's when creating a ticket. See [Setting Collaborators](/documentation/ticketing/managing-tickets/creating-and-updating-tickets#setting-collaborators)",
                            'items': {
                                'type': 'object',
                                'example': {
                                    'email': 'someone@example.com',
                                    'name': 'Someone Special'
                                },
                                'properties': {
                                    'email': {
                                        'type': 'string',
                                        'format': 'email'
                                    },
                                    'name': {
                                        'type': 'string'
                                    }
                                }
                            }
                        },
                        'comment': {
                            'type': 'object',
                            'description': 'Write only. An object that adds a comment to the ticket. See [Ticket comments](/api-reference/ticketing/tickets/ticket_comments/). To include an attachment with the comment, see [Attaching files](/documentation/ticketing/managing-tickets/creating-and-updating-tickets/#attaching-files)',
                            'writeOnly': true
                        },
                        'created_at': {
                            'type': 'string',
                            'format': 'date-time',
                            'description': 'When this record was created',
                            'readOnly': true
                        },
                        'custom_fields': {
                            'type': 'array',
                            'description': 'Custom fields for the ticket. See [Setting custom field values](/documentation/ticketing/managing-tickets/creating-and-updating-tickets#setting-custom-field-values)'
                        },
                        'custom_status_id': {
                            'type': 'integer',
                            'description': 'The custom ticket status id of the ticket. See [custom ticket statuses](#custom-ticket-statuses)'
                        },
                        'description': {
                            'type': 'string',
                            'description': 'Read-only first comment on the ticket. When [creating a ticket](#create-ticket), use `comment` to set the description. See [Description and first comment](#description-and-first-comment)\n',
                            'readOnly': true
                        },
                        'due_at': {
                            'type': 'string',
                            'format': 'date-time',
                            'description': 'If this is a ticket of type "task" it has a due date.  Due date format uses [ISO 8601](http://en.wikipedia.org/wiki/ISO_8601) format.',
                            'nullable': true
                        },
                        'email_cc_ids': {
                            'type': 'array',
                            'description': "The ids of agents or end users currently CC'ed on the ticket. See [CCs and followers resources](https://support.zendesk.com/hc/en-us/articles/360020585233) in the Support Help Center"
                        },
                        'email_ccs': {
                            'type': 'object',
                            'description': 'Write only. An array of objects that represent agent or end users email CCs to add or delete from the ticket. See [Setting email CCs](/documentation/ticketing/managing-tickets/creating-and-updating-tickets/#setting-email-ccs)',
                            'writeOnly': true
                        },
                        'external_id': {
                            'type': 'string',
                            'description': 'An id you can use to link Zendesk Support tickets to local records'
                        },
                        'follower_ids': {
                            'type': 'array',
                            'description': 'The ids of agents currently following the ticket. See [CCs and followers resources](https://support.zendesk.com/hc/en-us/articles/360020585233)'
                        },
                        'followers': {
                            'type': 'object',
                            'description': 'Write only. An array of objects that represent agent followers to add or delete from the ticket. See [Setting followers](/documentation/ticketing/managing-tickets/creating-and-updating-tickets/#setting-followers)',
                            'writeOnly': true
                        },
                        'followup_ids': {
                            'type': 'array',
                            'description': 'The ids of the followups created from this ticket. Ids are only visible once the ticket is closed',
                            'readOnly': true
                        },
                        'forum_topic_id': {
                            'type': 'integer',
                            'description': 'The topic in the Zendesk Web portal this ticket originated from, if any. The Web portal is deprecated',
                            'readOnly': true
                        },
                        'from_messaging_channel': {
                            'type': 'boolean',
                            'description': "If true, the ticket's [via type](/documentation/ticketing/reference-guides/via-object-reference/) is a messaging channel.",
                            'readOnly': true
                        },
                        'group_id': {
                            'type': 'integer',
                            'description': 'The group this ticket is assigned to'
                        },
                        'has_incidents': {
                            'type': 'boolean',
                            'description': 'Is true if a ticket is a problem type and has one or more incidents linked to it. Otherwise, the value is false.',
                            'readOnly': true
                        },
                        'id': {
                            'type': 'integer',
                            'description': 'Automatically assigned when the ticket is created',
                            'readOnly': true
                        },
                        'is_public': {
                            'type': 'boolean',
                            'description': 'Is true if any comments are public, false otherwise',
                            'readOnly': true
                        },
                        'macro_id': {
                            'type': 'integer',
                            'description': 'Write only. A macro ID to be recorded in the ticket audit',
                            'writeOnly': true
                        },
                        'macro_ids': {
                            'type': 'array',
                            'description': 'POST requests only. List of macro IDs to be recorded in the ticket audit'
                        },
                        'metadata': {
                            'type': 'object',
                            'description': 'Write only. Metadata for the audit. In the `audit` object, the data is specified in the `custom` property of the `metadata` object. See [Setting Metadata](/documentation/ticketing/managing-tickets/creating-and-updating-tickets/#setting-metadata)',
                            'writeOnly': true
                        },
                        'organization_id': {
                            'type': 'integer',
                            'description': 'The organization of the requester. You can only specify the ID of an organization associated with the requester. See [Organization Memberships](/api-reference/ticketing/organizations/organization_memberships/)'
                        },
                        'priority': {
                            'type': 'string',
                            'description': 'The urgency with which the ticket should be addressed.',
                            'enum': [
                                'urgent',
                                'high',
                                'normal',
                                'low'
                            ]
                        },
                        'problem_id': {
                            'type': 'integer',
                            'description': 'For tickets of type "incident", the ID of the problem the incident is linked to'
                        },
                        'raw_subject': {
                            'type': 'string',
                            'description': 'The dynamic content placeholder, if present, or the "subject" value, if not. See [Dynamic Content Items](/api-reference/ticketing/ticket-management/dynamic_content/)\n'
                        },
                        'recipient': {
                            'type': 'string',
                            'description': 'The original recipient e-mail address of the ticket. Notification emails for the ticket are sent from this address'
                        },
                        'requester': {
                            'type': 'object',
                            'description': 'Write only. See [Creating a ticket with a new requester](/documentation/ticketing/managing-tickets/creating-and-updating-tickets/#creating-a-ticket-with-a-new-requester)',
                            'writeOnly': true
                        },
                        'requester_id': {
                            'type': 'integer',
                            'description': 'The user who requested this ticket'
                        },
                        'safe_update': {
                            'type': 'boolean',
                            'description': 'Write only. Optional boolean. When true and an `update_stamp` date is included, protects against ticket update collisions and returns a message to let you know if one occurs. See [Protecting against ticket update collisions](/documentation/ticketing/managing-tickets/creating-and-updating-tickets/#protecting-against-ticket-update-collisions). A value of false has the same effect as true. Omit the property to force the updates to not be safe',
                            'writeOnly': true
                        },
                        'satisfaction_rating': {
                            'type': 'object',
                            'description': "The satisfaction rating of the ticket, if it exists, or the state of satisfaction, \"offered\" or \"unoffered\". The value is null for plan types that don't support CSAT",
                            'readOnly': true,
                            'additionalProperties': true
                        },
                        'sharing_agreement_ids': {
                            'type': 'array',
                            'description': 'The ids of the sharing agreements used for this ticket',
                            'readOnly': true
                        },
                        'status': {
                            'type': 'string',
                            'description': "The state of the ticket.\n\nIf your account has activated custom ticket statuses, this is the ticket's\nstatus category. See [custom ticket statuses](#custom-ticket-statuses).\n",
                            'enum': [
                                'new',
                                'open',
                                'pending',
                                'hold',
                                'solved',
                                'closed'
                            ]
                        },
                        'subject': {
                            'type': 'string',
                            'description': 'The value of the subject field for this ticket'
                        },
                        'submitter_id': {
                            'type': 'integer',
                            'description': 'The user who submitted the ticket. The submitter always becomes the author of the first comment on the ticket'
                        },
                        'tags': {
                            'type': 'array',
                            'description': 'The array of tags applied to this ticket'
                        },
                        'ticket_form_id': {
                            'type': 'integer',
                            'description': 'Enterprise only. The id of the ticket form to render for the ticket'
                        },
                        'type': {
                            'type': 'string',
                            'description': 'The type of this ticket.',
                            'enum': [
                                'problem',
                                'incident',
                                'question',
                                'task'
                            ]
                        },
                        'updated_at': {
                            'type': 'string',
                            'format': 'date-time',
                            'description': 'When this record last got updated',
                            'readOnly': true
                        },
                        'updated_stamp': {
                            'type': 'string',
                            'description': 'Write only. Datetime of last update received from API. See the `safe_update` property',
                            'writeOnly': true
                        },
                        'url': {
                            'type': 'string',
                            'description': 'The API url of this ticket',
                            'readOnly': true
                        },
                        'via': {
                            'type': 'object',
                            'description': 'For more information, see the [Via object reference](/documentation/ticketing/reference-guides/via-object-reference)',
                            'properties': {
                                'channel': {
                                    'type': 'string',
                                    'description': 'This tells you how the ticket or event was created. Examples: "web", "mobile", "rule", "system"\n'
                                },
                                'source': {
                                    'type': 'object',
                                    'description': 'For some channels a source object gives more information about how or why the ticket or event was created\n',
                                    'additionalProperties': true
                                }
                            }
                        },
                        'via_followup_source_id': {
                            'type': 'integer',
                            'description': 'POST requests only. The id of a closed ticket when creating a follow-up ticket. See [Creating a follow-up ticket](/documentation/ticketing/managing-tickets/creating-and-updating-tickets#creating-a-follow-up-ticket)'
                        },
                        'via_id': {
                            'type': 'integer',
                            'description': 'Write only. For more information, see the [Via object reference](/documentation/ticketing/reference-guides/via-object-reference/)',
                            'writeOnly': true
                        },
                        'voice_comment': {
                            'type': 'object',
                            'description': 'Write only. See [Creating voicemail ticket](/api-reference/voice/talk-partner-edition-api/reference/#creating-voicemail-tickets)',
                            'writeOnly': true
                        }
                    }
                }
            }
        }
    ],

    objectOutputOptions: [
        {
            'label': 'Allow Attachments',
            'value': 'allow_attachments'
        },
        {
            'label': 'Allow Channelback',
            'value': 'allow_channelback'
        },
        {
            'label': 'Assignee Email',
            'value': 'assignee_email'
        },
        {
            'label': 'Assignee Id',
            'value': 'assignee_id'
        },
        {
            'label': 'Attribute Value Ids',
            'value': 'attribute_value_ids',
            'schema': {
                'type': 'array',
                'description': 'Write only. An array of the IDs of attribute values to be associated with the ticket',
                'writeOnly': true
            }
        },
        {
            'label': 'Brand Id',
            'value': 'brand_id'
        },
        {
            'label': 'Collaborator Ids',
            'value': 'collaborator_ids',
            'schema': {
                'type': 'array',
                'description': "The ids of users currently CC'ed on the ticket"
            }
        },
        {
            'label': 'Collaborators',
            'value': 'collaborators',
            'schema': {
                'type': 'array',
                'description': "POST requests only. Users to add as cc's when creating a ticket. See [Setting Collaborators](/documentation/ticketing/managing-tickets/creating-and-updating-tickets#setting-collaborators)",
                'items': {
                    'type': 'object',
                    'example': {
                        'email': 'someone@example.com',
                        'name': 'Someone Special'
                    },
                    'properties': {
                        'email': {
                            'type': 'string',
                            'format': 'email'
                        },
                        'name': {
                            'type': 'string'
                        }
                    }
                }
            }
        },
        {
            'label': 'Comment',
            'value': 'comment'
        },
        {
            'label': 'Created At',
            'value': 'created_at'
        },
        {
            'label': 'Custom Fields',
            'value': 'custom_fields',
            'schema': {
                'type': 'array',
                'description': 'Custom fields for the ticket. See [Setting custom field values](/documentation/ticketing/managing-tickets/creating-and-updating-tickets#setting-custom-field-values)'
            }
        },
        {
            'label': 'Custom Status Id',
            'value': 'custom_status_id'
        },
        {
            'label': 'Description',
            'value': 'description'
        },
        {
            'label': 'Due At',
            'value': 'due_at'
        },
        {
            'label': 'Email Cc Ids',
            'value': 'email_cc_ids',
            'schema': {
                'type': 'array',
                'description': "The ids of agents or end users currently CC'ed on the ticket. See [CCs and followers resources](https://support.zendesk.com/hc/en-us/articles/360020585233) in the Support Help Center"
            }
        },
        {
            'label': 'Email Ccs',
            'value': 'email_ccs'
        },
        {
            'label': 'External Id',
            'value': 'external_id'
        },
        {
            'label': 'Follower Ids',
            'value': 'follower_ids',
            'schema': {
                'type': 'array',
                'description': 'The ids of agents currently following the ticket. See [CCs and followers resources](https://support.zendesk.com/hc/en-us/articles/360020585233)'
            }
        },
        {
            'label': 'Followers',
            'value': 'followers'
        },
        {
            'label': 'Followup Ids',
            'value': 'followup_ids',
            'schema': {
                'type': 'array',
                'description': 'The ids of the followups created from this ticket. Ids are only visible once the ticket is closed',
                'readOnly': true
            }
        },
        {
            'label': 'Forum Topic Id',
            'value': 'forum_topic_id'
        },
        {
            'label': 'From Messaging Channel',
            'value': 'from_messaging_channel'
        },
        {
            'label': 'Group Id',
            'value': 'group_id'
        },
        {
            'label': 'Has Incidents',
            'value': 'has_incidents'
        },
        {
            'label': 'Id',
            'value': 'id'
        },
        {
            'label': 'Is Public',
            'value': 'is_public'
        },
        {
            'label': 'Macro Id',
            'value': 'macro_id'
        },
        {
            'label': 'Macro Ids',
            'value': 'macro_ids',
            'schema': {
                'type': 'array',
                'description': 'POST requests only. List of macro IDs to be recorded in the ticket audit'
            }
        },
        {
            'label': 'Metadata',
            'value': 'metadata'
        },
        {
            'label': 'Organization Id',
            'value': 'organization_id'
        },
        {
            'label': 'Priority',
            'value': 'priority'
        },
        {
            'label': 'Problem Id',
            'value': 'problem_id'
        },
        {
            'label': 'Raw Subject',
            'value': 'raw_subject'
        },
        {
            'label': 'Recipient',
            'value': 'recipient'
        },
        {
            'label': 'Requester',
            'value': 'requester'
        },
        {
            'label': 'Requester Id',
            'value': 'requester_id'
        },
        {
            'label': 'Safe Update',
            'value': 'safe_update'
        },
        {
            'label': 'Satisfaction Rating',
            'value': 'satisfaction_rating'
        },
        {
            'label': 'Sharing Agreement Ids',
            'value': 'sharing_agreement_ids',
            'schema': {
                'type': 'array',
                'description': 'The ids of the sharing agreements used for this ticket',
                'readOnly': true
            }
        },
        {
            'label': 'Status',
            'value': 'status'
        },
        {
            'label': 'Subject',
            'value': 'subject'
        },
        {
            'label': 'Submitter Id',
            'value': 'submitter_id'
        },
        {
            'label': 'Tags',
            'value': 'tags',
            'schema': {
                'type': 'array',
                'description': 'The array of tags applied to this ticket'
            }
        },
        {
            'label': 'Ticket Form Id',
            'value': 'ticket_form_id'
        },
        {
            'label': 'Type',
            'value': 'type'
        },
        {
            'label': 'Updated At',
            'value': 'updated_at'
        },
        {
            'label': 'Updated Stamp',
            'value': 'updated_stamp'
        },
        {
            'label': 'Url',
            'value': 'url'
        },
        {
            'label': 'Via',
            'value': 'via'
        },
        {
            'label': 'Via Channel',
            'value': 'via.channel'
        },
        {
            'label': 'Via Source',
            'value': 'via.source'
        },
        {
            'label': 'Via Followup Source Id',
            'value': 'via_followup_source_id'
        },
        {
            'label': 'Via Id',
            'value': 'via_id'
        },
        {
            'label': 'Voice Comment',
            'value': 'voice_comment'
        }
    ]
};
