/* eslint-disable quotes */

'use strict';

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context);
        }

        const { query, outputType } = context.messages.in.content;
        const finalQuery = encodeURIComponent(`type:group ${query}`);
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
                return context.sendJson({ group: results[0], index: 0, count }, 'out');
            }
        } else if (outputType === 'object') {
            // One by one.
            for (let index = 0; index < results.length; index++) {
                const group = results[index];
                await context.sendJson({ group, index, count }, 'out');
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
            const savedFile = await context.saveFileStream(`zendesk-tickets-FindGroups-${(new Date).toISOString()}.csv`, buffer);
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
                    "label": "Group",
                    "value": "group",
                    "schema": this.groupSchema
                }
            ];
            return context.sendJson(options, 'out');
        } else if (outputType === 'array') {
            const options = [
                { "label": "Items Count", "value": "count", "schema": { "type": "integer" } },
                { label: 'Items', value: 'items', "schema": {
                    "type": "array",
                    "items": this.groupSchema
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

    groupSchema: {
        "type": "object",
        "properties": {
            "created_at": {
                "type": "string",
                "format": "date-time",
                "description": "The time the group was created",
                "readOnly": true
            },
            "default": {
                "type": "boolean",
                "description": "If the group is the default one for the account",
                "readOnly": true
            },
            "deleted": {
                "type": "boolean",
                "description": "Deleted groups get marked as such",
                "readOnly": true
            },
            "description": {
                "type": "string",
                "description": "The description of the group"
            },
            "id": {
                "type": "integer",
                "description": "Automatically assigned when creating groups",
                "readOnly": true
            },
            "is_public": {
                "type": "boolean",
                "description": "If true, the group is public.\nIf false, the group is private.\nYou can't change a private group to a public group\n"
            },
            "name": {
                "type": "string",
                "description": "The name of the group"
            },
            "updated_at": {
                "type": "string",
                "format": "date-time",
                "description": "The time of the last update of the group",
                "readOnly": true
            },
            "url": {
                "type": "string",
                "description": "The API url of the group",
                "readOnly": true
            }
        },
        "example": {
            "created_at": "2009-07-20T22:55:29Z",
            "default": true,
            "deleted": false,
            "description": "Some clever description here",
            "id": 3432,
            "is_public": true,
            "name": "First Level Support",
            "updated_at": "2011-05-05T10:38:52Z",
            "url": "https://company.zendesk.com/api/v2/groups/3432.json"
        }
    }
};
