/* eslint-disable quotes */

'use strict';

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context);
        }

        const { query, outputType } = context.messages.in.content;
        const finalQuery = encodeURIComponent(`type:organization ${query}`);
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
                return context.sendJson({ organization: results[0], index: 0, count }, 'out');
            }
        } else if (outputType === 'object') {
            // One by one.
            for (let index = 0; index < results.length; index++) {
                const organization = results[index];
                await context.sendJson({ organization, index, count }, 'out');
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
            const savedFile = await context.saveFileStream(`zendesk-tickets-FindOrganizations-${(new Date).toISOString()}.csv`, buffer);
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
                    "label": "Organization",
                    "value": "organization",
                    "schema": this.organizationSchema
                }
            ];
            return context.sendJson(options, 'out');
        } else if (outputType === 'array') {
            const options = [
                { "label": "Items Count", "value": "count", "schema": { "type": "integer" } },
                { label: 'Items', value: 'items', "schema": {
                    "type": "array",
                    "items": this.organizationSchema
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

    organizationSchema: {
        "type": "object",
        "properties": {
            "created_at": {
                "type": "string",
                "description": "The time the organization was created",
                "readOnly": true
            },
            "details": {
                "type": "string",
                "description": "Any details obout the organization, such as the address",
                "nullable": true
            },
            "domain_names": {
                "type": "array",
                "description": "An array of domain names associated with this organization",
                "items": {
                    "type": "string"
                }
            },
            "external_id": {
                "type": "string",
                "description": "A unique external id to associate organizations to an external record. The id is case-insensitive. For example, \"company1\" and \"Company1\" are considered the same",
                "nullable": true
            },
            "group_id": {
                "type": "integer",
                "description": "New tickets from users in this organization are automatically put in this group",
                "nullable": true
            },
            "id": {
                "type": "integer",
                "description": "Automatically assigned when the organization is created"
            },
            "name": {
                "type": "string",
                "description": "A unique name for the organization"
            },
            "notes": {
                "type": "string",
                "description": "Any notes you have about the organization",
                "nullable": true
            },
            "organization_fields": {
                "type": "object",
                "description": "Custom fields for this organization. See [Custom organization fields](/api-reference/ticketing/organizations/organizations/#custom-organization-fields)",
                "additionalProperties": {
                    "oneOf": [
                        {
                            "type": "string"
                        },
                        {
                            "type": "number"
                        }
                    ]
                },
                "nullable": true
            },
            "shared_comments": {
                "type": "boolean",
                "description": "End users in this organization are able to see each other's comments on tickets"
            },
            "shared_tickets": {
                "type": "boolean",
                "description": "End users in this organization are able to see each other's tickets"
            },
            "tags": {
                "type": "array",
                "description": "The tags of the organization",
                "items": {
                    "type": "string"
                }
            },
            "updated_at": {
                "type": "string",
                "description": "The time of the last update of the organization",
                "readOnly": true
            },
            "url": {
                "type": "string",
                "description": "The API url of this organization"
            }
        },
        "example": {
            "created_at": "2009-07-20T22:55:29Z",
            "details": "This is a kind of organization",
            "domain_names": [
                "example.com",
                "test.com"
            ],
            "external_id": "ABC123",
            "group_id": null,
            "id": 35436,
            "name": "One Organization",
            "notes": "",
            "organization_fields": {
                "org_decimal": 5.2,
                "org_dropdown": "option_1"
            },
            "shared_comments": true,
            "shared_tickets": true,
            "tags": [
                "enterprise",
                "other_tag"
            ],
            "updated_at": "2011-05-05T10:38:52Z",
            "url": "https://company.zendesk.com/api/v2/organizations/35436.json"
        }
    }
};
