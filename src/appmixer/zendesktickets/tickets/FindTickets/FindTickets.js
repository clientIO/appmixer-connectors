/* eslint-disable quotes */

'use strict';

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context);
        }

        const { query, outputType } = context.messages.in.content;
        const finalQuery = encodeURIComponent(`type:ticket ${query}`);
        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/search.json?query=${finalQuery}`;
        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken
        };
        const req = {
            url: url,
            method: 'GET',
            headers: headers
        };
        const { data } = await context.httpRequest(req);
        const { results = [], count } = data;

        if (outputType === 'first') {
            // First item only.
            if (results.length > 0) {
                return context.sendJson({ ticket: results[0], index: 0, count }, 'out');
            }
        } else if (outputType === 'object') {
            // One by one.
            for (let index = 0; index < results.length; index++) {
                const ticket = results[index];
                await context.sendJson({ ticket, index, count }, 'out');
            }
        } else if (outputType === 'array') {
            // All at once.
            return context.sendJson({ items: results, count }, 'out');
        } else if (outputType === 'file') {
            // Into CSV file.
            // Expand objects first level (ticket) to columns.
            const firstItem = results[0];
            let headers = [];
            Object.keys(firstItem).map(key => {
                if (firstItem[key] && typeof firstItem[key] === 'object') {
                    headers = headers.concat(Object.keys(firstItem[key]).map(subKey => `${key}.${subKey}`));
                } else {
                    headers.push(key);
                }
            });
            let csvRows = [];
            csvRows.push(headers.join(','));
            for (const file of results) {
                const values = headers.map(header => {
                    let val;
                    if (header.includes('.')) {
                        const [key, subKey] = header.split('.');
                        val = file[key][subKey];
                    } else {
                        val = file[header];
                    }
                    if (typeof val === 'object' || Array.isArray(val)) {
                        val = JSON.stringify(val);
                    }
                    return `"${val}"`;
                });
                // To add ',' separator between each value
                csvRows.push(values.join(','));
            }
            const csvString = csvRows.join('\n');
            let buffer = Buffer.from(csvString, 'utf8');
            const savedFile = await context.saveFileStream(`zendesktickets-tickets-FindTickets-${(new Date).toISOString()}.csv`, buffer);
            return context.sendJson({ fileId: savedFile.fileId, count }, 'out');
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    getOutputPortOptions(context) {

        const { outputType } = context.messages.in.content;
        if (outputType === 'object' || outputType === 'first') {
            const options = [
                { "label": "Current Item Index", "value": "index", "schema": { "type": "integer" } },
                { "label": "Items Count", "value": "count", "schema": { "type": "integer" } },
                {
                    "label": "Ticket",
                    "value": "ticket",
                    "schema": this.ticketSchema
                }
            ];
            return context.sendJson(options, 'out');
        } else if (outputType === 'array') {
            const options = [
                { "label": "Items Count", "value": "count", "schema": { "type": "integer" } },
                { label: 'Items', value: 'items', "schema": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "index": { "type": "integer", "title": "Current Item Index" },
                            "ticket": this.ticketSchema
                        }
                    }
                } }
            ];
            return context.sendJson(options, 'out');
        } else {        // file
            return context.sendJson([
                { "label": "Items Count", "value": "count", "schema": { "type": "integer" } },
                { label: 'File ID', value: 'fileId', "schema": { "type": "string", "format": "appmixer-file-id" } }
            ], 'out');
        }
    },

    ticketSchema: {
        "type": "object",
        "properties": {
            "allow_attachments": {
                "type": "boolean",
                "description": "Permission for agents to add add attachments to a comment. Defaults to true",
                "readOnly": true
            },
            "allow_channelback": {
                "type": "boolean",
                "description": "Is false if channelback is disabled, true otherwise. Only applicable for channels framework ticket",
                "readOnly": true
            },
            "assignee_email": {
                "type": "string",
                "description": "Write only. The email address of the agent to assign the ticket to",
                "writeOnly": true
            },
            "assignee_id": {
                "type": "integer",
                "description": "The agent currently assigned to the ticket"
            },
            "attribute_value_ids": {
                "type": "array",
                "description": "Write only. An array of the IDs of attribute values to be associated with the ticket",
                "writeOnly": true
            },
            "brand_id": {
                "type": "integer",
                "description": "Enterprise only. The id of the brand this ticket is associated with"
            },
            "collaborator_ids": {
                "type": "array",
                "description": "The ids of users currently CC'ed on the ticket"
            },
            "collaborators": {
                "type": "array",
                "description": "POST requests only. Users to add as cc's when creating a ticket. See [Setting Collaborators](/documentation/ticketing/managing-tickets/creating-and-updating-tickets#setting-collaborators)",
                "items": {
                    "type": "object",
                    "properties": {
                        "email": {
                            "type": "string",
                            "format": "email"
                        },
                        "name": {
                            "type": "string"
                        }
                    },
                    "example": {
                        "email": "someone@example.com",
                        "name": "Someone Special"
                    }
                }
            },
            "comment": {
                "type": "object",
                "description": "Write only. An object that adds a comment to the ticket. See [Ticket comments](/api-reference/ticketing/tickets/ticket_comments/). To include an attachment with the comment, see [Attaching files](/documentation/ticketing/managing-tickets/creating-and-updating-tickets/#attaching-files)",
                "writeOnly": true
            },
            "created_at": {
                "type": "string",
                "format": "date-time",
                "description": "When this record was created",
                "readOnly": true
            },
            "custom_fields": {
                "type": "array",
                "description": "Custom fields for the ticket. See [Setting custom field values](/documentation/ticketing/managing-tickets/creating-and-updating-tickets#setting-custom-field-values)"
            },
            "custom_status_id": {
                "type": "integer",
                "description": "The custom ticket status id of the ticket. See [custom ticket statuses](#custom-ticket-statuses)"
            },
            "description": {
                "type": "string",
                "description": "Read-only first comment on the ticket. When [creating a ticket](#create-ticket), use `comment` to set the description. See [Description and first comment](#description-and-first-comment)\n",
                "readOnly": true
            },
            "due_at": {
                "type": "string",
                "format": "date-time",
                "description": "If this is a ticket of type \"task\" it has a due date.  Due date format uses [ISO 8601](http://en.wikipedia.org/wiki/ISO_8601) format.",
                "nullable": true
            },
            "email_cc_ids": {
                "type": "array",
                "description": "The ids of agents or end users currently CC'ed on the ticket. See [CCs and followers resources](https://support.zendesk.com/hc/en-us/articles/360020585233) in the Support Help Center"
            },
            "email_ccs": {
                "type": "object",
                "description": "Write only. An array of objects that represent agent or end users email CCs to add or delete from the ticket. See [Setting email CCs](/documentation/ticketing/managing-tickets/creating-and-updating-tickets/#setting-email-ccs)",
                "writeOnly": true
            },
            "external_id": {
                "type": "string",
                "description": "An id you can use to link Zendesk Support tickets to local records"
            },
            "follower_ids": {
                "type": "array",
                "description": "The ids of agents currently following the ticket. See [CCs and followers resources](https://support.zendesk.com/hc/en-us/articles/360020585233)"
            },
            "followers": {
                "type": "object",
                "description": "Write only. An array of objects that represent agent followers to add or delete from the ticket. See [Setting followers](/documentation/ticketing/managing-tickets/creating-and-updating-tickets/#setting-followers)",
                "writeOnly": true
            },
            "followup_ids": {
                "type": "array",
                "description": "The ids of the followups created from this ticket. Ids are only visible once the ticket is closed",
                "readOnly": true
            },
            "forum_topic_id": {
                "type": "integer",
                "description": "The topic in the Zendesk Web portal this ticket originated from, if any. The Web portal is deprecated",
                "readOnly": true
            },
            "from_messaging_channel": {
                "type": "boolean",
                "description": "If true, the ticket's [via type](/documentation/ticketing/reference-guides/via-object-reference/) is a messaging channel.",
                "readOnly": true
            },
            "group_id": {
                "type": "integer",
                "description": "The group this ticket is assigned to"
            },
            "has_incidents": {
                "type": "boolean",
                "description": "Is true if a ticket is a problem type and has one or more incidents linked to it. Otherwise, the value is false.",
                "readOnly": true
            },
            "id": {
                "type": "integer",
                "description": "Automatically assigned when the ticket is created",
                "readOnly": true
            },
            "is_public": {
                "type": "boolean",
                "description": "Is true if any comments are public, false otherwise",
                "readOnly": true
            },
            "macro_id": {
                "type": "integer",
                "description": "Write only. A macro ID to be recorded in the ticket audit",
                "writeOnly": true
            },
            "macro_ids": {
                "type": "array",
                "description": "POST requests only. List of macro IDs to be recorded in the ticket audit"
            },
            "metadata": {
                "type": "object",
                "description": "Write only. Metadata for the audit. In the `audit` object, the data is specified in the `custom` property of the `metadata` object. See [Setting Metadata](/documentation/ticketing/managing-tickets/creating-and-updating-tickets/#setting-metadata)",
                "writeOnly": true
            },
            "organization_id": {
                "type": "integer",
                "description": "The organization of the requester. You can only specify the ID of an organization associated with the requester. See [Organization Memberships](/api-reference/ticketing/organizations/organization_memberships/)"
            },
            "priority": {
                "type": "string",
                "description": "The urgency with which the ticket should be addressed.",
                "enum": [
                    "urgent",
                    "high",
                    "normal",
                    "low"
                ]
            },
            "problem_id": {
                "type": "integer",
                "description": "For tickets of type \"incident\", the ID of the problem the incident is linked to"
            },
            "raw_subject": {
                "type": "string",
                "description": "The dynamic content placeholder, if present, or the \"subject\" value, if not. See [Dynamic Content Items](/api-reference/ticketing/ticket-management/dynamic_content/)\n"
            },
            "recipient": {
                "type": "string",
                "description": "The original recipient e-mail address of the ticket. Notification emails for the ticket are sent from this address"
            },
            "requester": {
                "type": "object",
                "description": "Write only. See [Creating a ticket with a new requester](/documentation/ticketing/managing-tickets/creating-and-updating-tickets/#creating-a-ticket-with-a-new-requester)",
                "writeOnly": true
            },
            "requester_id": {
                "type": "integer",
                "description": "The user who requested this ticket"
            },
            "safe_update": {
                "type": "boolean",
                "description": "Write only. Optional boolean. When true and an `update_stamp` date is included, protects against ticket update collisions and returns a message to let you know if one occurs. See [Protecting against ticket update collisions](/documentation/ticketing/managing-tickets/creating-and-updating-tickets/#protecting-against-ticket-update-collisions). A value of false has the same effect as true. Omit the property to force the updates to not be safe",
                "writeOnly": true
            },
            "satisfaction_rating": {
                "type": "object",
                "description": "The satisfaction rating of the ticket, if it exists, or the state of satisfaction, \"offered\" or \"unoffered\". The value is null for plan types that don't support CSAT",
                "additionalProperties": true,
                "readOnly": true
            },
            "sharing_agreement_ids": {
                "type": "array",
                "description": "The ids of the sharing agreements used for this ticket",
                "readOnly": true
            },
            "status": {
                "type": "string",
                "description": "The state of the ticket.\n\nIf your account has activated custom ticket statuses, this is the ticket's\nstatus category. See [custom ticket statuses](#custom-ticket-statuses).\n",
                "enum": [
                    "new",
                    "open",
                    "pending",
                    "hold",
                    "solved",
                    "closed"
                ]
            },
            "subject": {
                "type": "string",
                "description": "The value of the subject field for this ticket"
            },
            "submitter_id": {
                "type": "integer",
                "description": "The user who submitted the ticket. The submitter always becomes the author of the first comment on the ticket"
            },
            "tags": {
                "type": "array",
                "description": "The array of tags applied to this ticket"
            },
            "ticket_form_id": {
                "type": "integer",
                "description": "Enterprise only. The id of the ticket form to render for the ticket"
            },
            "type": {
                "type": "string",
                "description": "The type of this ticket.",
                "enum": [
                    "problem",
                    "incident",
                    "question",
                    "task"
                ]
            },
            "updated_at": {
                "type": "string",
                "format": "date-time",
                "description": "When this record last got updated",
                "readOnly": true
            },
            "updated_stamp": {
                "type": "string",
                "description": "Write only. Datetime of last update received from API. See the `safe_update` property",
                "writeOnly": true
            },
            "url": {
                "type": "string",
                "description": "The API url of this ticket",
                "readOnly": true
            },
            "via": {
                "type": "object",
                "description": "For more information, see the [Via object reference](/documentation/ticketing/reference-guides/via-object-reference)",
                "properties": {
                    "channel": {
                        "type": "string",
                        "description": "This tells you how the ticket or event was created. Examples: \"web\", \"mobile\", \"rule\", \"system\"\n"
                    },
                    "source": {
                        "type": "object",
                        "description": "For some channels a source object gives more information about how or why the ticket or event was created\n",
                        "additionalProperties": true
                    }
                }
            },
            "via_followup_source_id": {
                "type": "integer",
                "description": "POST requests only. The id of a closed ticket when creating a follow-up ticket. See [Creating a follow-up ticket](/documentation/ticketing/managing-tickets/creating-and-updating-tickets#creating-a-follow-up-ticket)"
            },
            "via_id": {
                "type": "integer",
                "description": "Write only. For more information, see the [Via object reference](/documentation/ticketing/reference-guides/via-object-reference/)",
                "writeOnly": true
            },
            "voice_comment": {
                "type": "object",
                "description": "Write only. See [Creating voicemail ticket](/api-reference/voice/talk-partner-edition-api/reference/#creating-voicemail-tickets)",
                "writeOnly": true
            }
        }
    }
};
