'use strict';
const mime = require('mime-types');
const { trimUndefined } = require('../../commons');
const axios = require('axios');
const FormData = require('form-data');

module.exports = {

    async receive(context) {

        const { content } = context.messages.in;

        const { filePickerFilename, filePickerContent } = context.properties;

        if (filePickerFilename) {
            // Component was called to save a file
            const mimeType = mime.lookup(filePickerFilename);
            const file = await context.saveFile(filePickerFilename, mimeType, Buffer.from(filePickerContent, 'utf8'));
            return context.sendJson({ attachmentId: file.fileId }, 'updatedTicket');
        } else {
            // Triggered from flow
            const { auth } = context;

            let body = {
                subject: content.subject,
                description: content.description,
                type: content.type,
                status: content.status,
                priority: content.priority,
                name: content.requesterName,
                email: content.requesterEmail,
                requester_id: content.requesterId,
                facebook_id: content.requesterFacebookId,
                phone: content.requesterPhone,
                twitter_id: content.requesterTwitterId,
                unique_external_id: content.requesterUniqueExternalId,
                responder_id: content.agentId,
                tags: content.tags ? content.tags.split(',') : undefined
            };

            const url = `https://${auth.domain}.freshdesk.com/api/v2/tickets/${content.ticketId}`;

            let response;

            if (content.attachmentId) {
                const formData = new FormData();

                const fileInfo = await context.getFileInfo(content.attachmentId);
                const fileStream = await context.getFileReadStream(content.attachmentId);

                formData.append('attachments[]', fileStream, {
                    filename: fileInfo.filename,
                    contentType: fileInfo.contentType,
                    knownLength: fileInfo.length
                });

                body = trimUndefined(body);

                Object.entries(body).forEach(([key, value]) => {
                    if (key === 'tags') {
                        value.forEach(tag => formData.append('tags[]', tag));
                    } else {
                        formData.append(key, value);
                    }
                });

                response = await axios.put(url, formData, {
                    auth: {
                        username: auth.apiKey,
                        password: 'X'
                    },
                    headers: formData.getHeaders()
                });
            } else {
                response = await axios.put(url, trimUndefined(body), {
                    auth: {
                        username: auth.apiKey,
                        password: 'X'
                    }
                });
            }

            const { data } = response;

            const message = {
                ...body,
                id: data.id,
                requesterId: data.requester_id,
                createdAt: data.created_at,
                dueBy: data.due_by
            };

            return context.sendJson(message, 'updatedTicket');
        }
    }
};
