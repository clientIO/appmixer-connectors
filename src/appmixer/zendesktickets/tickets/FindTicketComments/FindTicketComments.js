/* eslint-disable quotes */

'use strict';

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context);
        }

        const input = context.messages.in.content;
        const outputType = input['outputType'];
        const sort = input['sort'];
        const ticketId = input['ticket|id'];
        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/tickets/${ticketId}/comments?sort=${sort}`;
        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken
        };
        const req = {
            url: url,
            method: 'GET',
            headers: headers
        };
        const { data } = await context.httpRequest(req);
        const { comments = [], count } = data;
        const results = comments;

        if (outputType === 'firstItem') {
            // First item only.
            if (results.length > 0) {
                return context.sendJson({ comment: results[0], index: 0, count }, 'out');
            }
        } else if (outputType === 'item') {
            // One by one.
            for (let index = 0; index < results.length; index++) {
                const comment = results[index];
                await context.sendJson({ comment, index, count }, 'out');
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
            const savedFile = await context.saveFileStream(`zendesktickets-tickets-FindTicketComments-${(new Date).toISOString()}.csv`, buffer);
            return context.sendJson({ fileId: savedFile.fileId, count }, 'out');
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    getOutputPortOptions(context) {

        const { outputType } = context.messages.in.content;
        if (outputType === 'item' || outputType === 'firstItem') {
            const options = [
                { "label": "Current Item Index", "value": "index", "schema": { "type": "integer" } },
                { "label": "Items Count", "value": "count", "schema": { "type": "integer" } },
                {
                    "label": "Comment",
                    "value": "comment",
                    "schema": this.commentSchema
                }
            ];
            return context.sendJson(options, 'out');
        } else if (outputType === 'array') {
            const options = [
                { "label": "Items Count", "value": "count", "schema": { "type": "integer" } },
                { label: 'Items', value: 'items', "schema": {
                    "type": "array",
                    "items": this.commentSchema
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

    commentSchema: {
        "type": "object",
        "properties": {
            "attachments": {
                "type": "array",
                "description": "Attachments, if any. See [Attachment](/api-reference/ticketing/tickets/ticket-attachments/)",
                "items": {
                    "type": "object",
                    "description": "A file represented as an [Attachment](/api-reference/ticketing/tickets/ticket-attachments/) object",
                    "properties": {
                        "content_type": {
                            "type": "string",
                            "description": "The content type of the image. Example value: \"image/png\"",
                            "readOnly": true
                        },
                        "content_url": {
                            "type": "string",
                            "description": "A full URL where the attachment image file can be downloaded. The file may be hosted externally so take care not to inadvertently send Zendesk authentication credentials. See [Working with url properties](/documentation/ticketing/managing-tickets/working-with-url-properties)",
                            "readOnly": true
                        },
                        "deleted": {
                            "type": "boolean",
                            "description": "If true, the attachment has been deleted",
                            "readOnly": true
                        },
                        "file_name": {
                            "type": "string",
                            "description": "The name of the image file",
                            "readOnly": true
                        },
                        "height": {
                            "type": "string",
                            "description": "The height of the image file in pixels. If height is unknown, returns null",
                            "readOnly": true
                        },
                        "id": {
                            "type": "integer",
                            "description": "Automatically assigned when created",
                            "readOnly": true
                        },
                        "inline": {
                            "type": "boolean",
                            "description": "If true, the attachment is excluded from the attachment list and the attachment's URL\ncan be referenced within the comment of a ticket. Default is false\n",
                            "readOnly": true
                        },
                        "malware_access_override": {
                            "type": "boolean",
                            "description": "If true, you can download an attachment flagged as malware. If false, you can't download such an attachment.",
                            "readOnly": true
                        },
                        "malware_scan_result": {
                            "type": "string",
                            "description": "The result of the malware scan. There is a delay between the time the attachment is uploaded and when the malware scan is completed. Usually the scan is done within a few seconds, but high load conditions can delay the scan results. Possible values: \"malware_found\", \"malware_not_found\", \"failed_to_scan\", \"not_scanned\"",
                            "readOnly": true
                        },
                        "mapped_content_url": {
                            "type": "string",
                            "description": "The URL the attachment image file has been mapped to",
                            "readOnly": true
                        },
                        "size": {
                            "type": "integer",
                            "description": "The size of the image file in bytes",
                            "readOnly": true
                        },
                        "url": {
                            "type": "string",
                            "description": "A URL to access the attachment details",
                            "readOnly": true
                        },
                        "width": {
                            "type": "string",
                            "description": "The width of the image file in pixels. If width is unknown, returns null",
                            "readOnly": true
                        },
                        "thumbnails": {
                            "type": "array",
                            "description": "An array of attachment objects. Note that photo thumbnails do not have thumbnails",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "content_type": {
                                        "type": "string",
                                        "description": "The content type of the image. Example value: \"image/png\"",
                                        "readOnly": true
                                    },
                                    "content_url": {
                                        "type": "string",
                                        "description": "A full URL where the attachment image file can be downloaded. The file may be hosted externally so take care not to inadvertently send Zendesk authentication credentials. See [Working with url properties](/documentation/ticketing/managing-tickets/working-with-url-properties)",
                                        "readOnly": true
                                    },
                                    "deleted": {
                                        "type": "boolean",
                                        "description": "If true, the attachment has been deleted",
                                        "readOnly": true
                                    },
                                    "file_name": {
                                        "type": "string",
                                        "description": "The name of the image file",
                                        "readOnly": true
                                    },
                                    "height": {
                                        "type": "string",
                                        "description": "The height of the image file in pixels. If height is unknown, returns null",
                                        "readOnly": true
                                    },
                                    "id": {
                                        "type": "integer",
                                        "description": "Automatically assigned when created",
                                        "readOnly": true
                                    },
                                    "inline": {
                                        "type": "boolean",
                                        "description": "If true, the attachment is excluded from the attachment list and the attachment's URL\ncan be referenced within the comment of a ticket. Default is false\n",
                                        "readOnly": true
                                    },
                                    "malware_access_override": {
                                        "type": "boolean",
                                        "description": "If true, you can download an attachment flagged as malware. If false, you can't download such an attachment.",
                                        "readOnly": true
                                    },
                                    "malware_scan_result": {
                                        "type": "string",
                                        "description": "The result of the malware scan. There is a delay between the time the attachment is uploaded and when the malware scan is completed. Usually the scan is done within a few seconds, but high load conditions can delay the scan results. Possible values: \"malware_found\", \"malware_not_found\", \"failed_to_scan\", \"not_scanned\"",
                                        "readOnly": true
                                    },
                                    "mapped_content_url": {
                                        "type": "string",
                                        "description": "The URL the attachment image file has been mapped to",
                                        "readOnly": true
                                    },
                                    "size": {
                                        "type": "integer",
                                        "description": "The size of the image file in bytes",
                                        "readOnly": true
                                    },
                                    "url": {
                                        "type": "string",
                                        "description": "A URL to access the attachment details",
                                        "readOnly": true
                                    },
                                    "width": {
                                        "type": "string",
                                        "description": "The width of the image file in pixels. If width is unknown, returns null",
                                        "readOnly": true
                                    }
                                }
                            }
                        }
                    },
                    "example": {
                        "content_type": "image/png",
                        "content_url": "https://company.zendesk.com/attachments/my_funny_profile_pic.png",
                        "file_name": "my_funny_profile_pic.png",
                        "id": 928374,
                        "size": 166144,
                        "thumbnails": [
                            {
                                "content_type": "image/png",
                                "content_url": "https://company.zendesk.com/attachments/my_funny_profile_pic_thumb.png",
                                "file_name": "my_funny_profile_pic_thumb.png",
                                "id": 928375,
                                "size": 58298
                            }
                        ]
                    }
                },
                "readOnly": true
            },
            "audit_id": {
                "type": "integer",
                "description": "The id of the ticket audit record. See [Show Audit](/api-reference/ticketing/tickets/ticket_audits/#show-audit)",
                "readOnly": true
            },
            "author_id": {
                "type": "integer",
                "description": "The id of the comment author. See [Author id](#author-id)"
            },
            "body": {
                "type": "string",
                "description": "The comment string. See [Bodies](#bodies)"
            },
            "created_at": {
                "type": "string",
                "format": "date-time",
                "description": "The time the comment was created",
                "readOnly": true
            },
            "html_body": {
                "type": "string",
                "description": "The comment formatted as HTML. See [Bodies](#bodies)"
            },
            "id": {
                "type": "integer",
                "description": "Automatically assigned when the comment is created",
                "readOnly": true
            },
            "metadata": {
                "type": "object",
                "description": "System information (web client, IP address, etc.) and comment flags, if any. See [Comment flags](#comment-flags)",
                "additionalProperties": true,
                "readOnly": true
            },
            "plain_body": {
                "type": "string",
                "description": "The comment presented as plain text. See [Bodies](#bodies)",
                "readOnly": true
            },
            "public": {
                "type": "boolean",
                "description": "true if a public comment; false if an internal note. The initial value set on ticket creation persists for any additional comment unless you change it"
            },
            "type": {
                "type": "string",
                "description": "`Comment` or `VoiceComment`. The JSON object for adding voice comments to tickets is different. See [Adding voice comments to tickets](/documentation/ticketing/managing-tickets/adding-voice-comments-to-tickets)",
                "readOnly": true
            },
            "uploads": {
                "type": "array",
                "description": "List of tokens received from [uploading files](/api-reference/ticketing/tickets/ticket-attachments/#upload-files) for comment attachments. The files are attached by creating or updating tickets with the tokens. See [Attaching files](/api-reference/ticketing/tickets/tickets/#attaching-files) in Tickets",
                "items": {
                    "type": "string"
                }
            },
            "via": {
                "type": "object",
                "description": "Describes how the object was created. See the [Via object reference](/documentation/ticketing/reference-guides/via-object-reference)",
                "properties": {
                    "channel": {
                        "type": "string",
                        "description": "This tells you how the ticket or event was created. Examples: \"web\", \"mobile\", \"rule\", \"system\"",
                        "readOnly": true
                    },
                    "source": {
                        "type": "object",
                        "description": "For some channels a source object gives more information about how or why the ticket or event was created",
                        "additionalProperties": true,
                        "readOnly": true
                    }
                }
            }
        }
    }
};
