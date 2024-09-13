/* eslint-disable quotes */

'use strict';

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context);
        }

        const { query, outputType } = context.messages.in.content;
        const finalQuery = encodeURIComponent(`type:user ${query}`);
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
                return context.sendJson({ user: results[0], index: 0, count }, 'out');
            }
        } else if (outputType === 'object') {
            // One by one.
            for (let index = 0; index < results.length; index++) {
                const user = results[index];
                await context.sendJson({ user, index, count }, 'out');
            }
        } else if (outputType === 'array') {
            // All at once.
            return context.sendJson({ items: results, count }, 'out');
        } else if (outputType === 'file') {
            // Into CSV file.
            // Expand objects first level to columns.
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
            const savedFile = await context.saveFileStream(`zendesktickets-users-FindUsers-${(new Date).toISOString()}.csv`, buffer);
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
                    "label": "User",
                    "value": "user",
                    "schema": this.userSchema
                }
            ];
            return context.sendJson(options, 'out');
        } else if (outputType === 'array') {
            const options = [
                { "label": "Items Count", "value": "count", "schema": { "type": "integer" } },
                { label: 'Items', value: 'items', "schema": {
                    "type": "array",
                    "items": this.userSchema
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

    toSelectArray(out) {
        return (out.items || []).map(item => {
            return {
                label: item.name,
                value: item.id
            };
        });
    },

    userSchema: {

        "type": "object",
        "properties": {
            "created_at": {
                "type": "string",
                "format": "datetime",
                "description": "The time the user was created",
                "readOnly": true
            },
            "email": {
                "type": "string",
                "description": "The primary email address of this user. If the primary email address is not [verified](https://support.zendesk.com/hc/en-us/articles/4408886752410), the secondary email address is used"
            },
            "iana_time_zone": {
                "type": "string",
                "description": "The time zone for the user",
                "readOnly": true
            },
            "id": {
                "type": "integer",
                "description": "Automatically assigned when creating users",
                "readOnly": true
            },
            "custom_role_id": {
                "type": "integer",
                "description": "A custom role if the user is an agent on the Enterprise plan or above",
                "nullable": true
            },
            "details": {
                "type": "string",
                "description": "Any details you want to store about the user, such as an address"
            },
            "alias": {
                "type": "string",
                "description": "An alias displayed to end users"
            },
            "chat_only": {
                "type": "boolean",
                "description": "Whether or not the user is a chat-only agent",
                "readOnly": true
            },
            "locale": {
                "type": "string",
                "description": "The locale for this user",
                "readOnly": true
            },
            "locale_id": {
                "type": "integer",
                "description": "The language identifier for this user"
            },
            "name": {
                "type": "string",
                "description": "The name of the user"
            },
            "organization_id": {
                "type": "integer",
                "description": "The id of the user's organization. If the user has more than one [organization memberships](/api-reference/ticketing/organizations/organization_memberships/), the id of the user's default organization. If updating, see [Organization ID](/api-reference/ticketing/users/users/#organization-id)"
            },
            "phone": {
                "type": "string",
                "description": "The primary phone number of this user. See [Phone Number](/api-reference/ticketing/users/users/#phone-number) in the Users API"
            },
            "photo": {
                "type": "object",
                "description": "The user's profile picture represented as an [Attachment](/api-reference/ticketing/tickets/ticket-attachments/) object",
                "additionalProperties": true
            },
            "role": {
                "type": "string",
                "description": "The role of the user. Possible values: `\"end-user\"`, `\"agent\"`, `\"admin\"`"
            },
            "role_type": {
                "type": "integer",
                "description": "The user's role id. 0 for a custom agent, 1 for a light agent, 2 for a chat agent, 3 for a chat agent added to the Support account as a contributor ([Chat Phase 4](https://support.zendesk.com/hc/en-us/articles/360022365373#topic_djh_1zk_4fb)), 4 for an admin, and 5 for a billing admin",
                "nullable": true,
                "readOnly": true
            },
            "shared": {
                "type": "boolean",
                "description": "If the user is shared from a different Zendesk Support instance. Ticket sharing accounts only",
                "readOnly": true
            },
            "shared_agent": {
                "type": "boolean",
                "description": "If the user is a shared agent from a different Zendesk Support instance. Ticket sharing accounts only",
                "readOnly": true
            },
            "signature": {
                "type": "string",
                "description": "The user's signature. Only agents and admins can have signatures"
            },
            "shared_phone_number": {
                "type": "boolean",
                "description": "Whether the `phone` number is shared or not. See [Phone Number](/api-reference/ticketing/users/users/#phone-number) in the Users API"
            },
            "time_zone": {
                "type": "string",
                "description": "The time-zone of this user"
            },
            "updated_at": {
                "type": "string",
                "format": "datetime",
                "description": "The time of the last update of the user",
                "readOnly": true
            },
            "url": {
                "type": "string",
                "description": "The API url of this user",
                "readOnly": true
            },
            "verified": {
                "type": "boolean",
                "description": "Any of the user's identities is verified. See [User Identities](/api-reference/ticketing/users/user_identities)"
            },
            "external_id": {
                "type": "string",
                "description": "A unique identifier from another system. The API treats the id as case insensitive. Example: \"ian1\" and \"IAN1\" are the same value.",
                "nullable": true
            },
            "default_group_id": {
                "type": "integer",
                "description": "The id of the user's default group"
            },
            "last_login_at": {
                "type": "string",
                "format": "datetime",
                "description": "Last time the user signed in to Zendesk Support or made an API request\nusing an API token or basic authentication\n",
                "readOnly": true
            },
            "moderator": {
                "type": "boolean",
                "description": "Designates whether the user has forum moderation capabilities"
            },
            "notes": {
                "type": "string",
                "description": "Any notes you want to store about the user"
            },
            "only_private_comments": {
                "type": "boolean",
                "description": "true if the user can only create private comments"
            },
            "remote_photo_url": {
                "type": "string",
                "description": "A URL pointing to the user's profile picture."
            },
            "report_csv": {
                "type": "boolean",
                "description": "This parameter is inert and has no effect. It may be deprecated in the\nfuture.\n\nPreviously, this parameter determined whether a user could access a CSV\nreport in a legacy Guide dashboard. This dashboard has been removed. See\n[Announcing Guide legacy reporting upgrade to\nExplore](https://support.zendesk.com/hc/en-us/articles/4762263171610-Announcing-Guide-legacy-reporting-upgrade-to-Explore-)\n",
                "readOnly": true
            },
            "restricted_agent": {
                "type": "boolean",
                "description": "If the agent has any restrictions; false for admins and unrestricted agents, true for other agents"
            },
            "suspended": {
                "type": "boolean",
                "description": "If the agent is suspended. Tickets from suspended users are also suspended, and these users cannot sign in to the end user portal"
            },
            "tags": {
                "type": "array",
                "description": "The user's tags. Only present if your account has user tagging enabled",
                "items": {
                    "type": "string"
                }
            },
            "ticket_restriction": {
                "type": "string",
                "description": "Specifies which tickets the user has access to. Possible values are: \"organization\", \"groups\", \"assigned\", \"requested\", null. \"groups\" and \"assigned\" are valid only for agents. If you pass an invalid value to an end user (for example, \"groups\"), they will be assigned to \"requested\", regardless of their previous access",
                "nullable": true
            },
            "two_factor_auth_enabled": {
                "type": "boolean",
                "description": "If two factor authentication is enabled",
                "nullable": true,
                "readOnly": true
            },
            "user_fields": {
                "type": "object",
                "description": "Values of custom fields in the user's profile. See [User Fields](#user-fields)",
                "additionalProperties": true
            }
        }
    }
};
