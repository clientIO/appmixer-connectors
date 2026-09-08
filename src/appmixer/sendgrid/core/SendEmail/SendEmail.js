'use strict';

module.exports = {

    async receive(context) {

        const {
            fromEmail,
            fromName,
            toEmail,
            subject,
            contentType,
            content,
            ccEmail,
            bccEmail,
            replyToEmail,
            categories,
            sendAt,
            enableSandbox
        } = context.messages.in.content;

        if (!fromEmail) {
            throw new context.CancelError('Sender Email is required!');
        }

        if (!toEmail) {
            throw new context.CancelError('Recipient Email is required!');
        }

        if (!subject) {
            throw new context.CancelError('Subject is required!');
        }

        if (!content) {
            throw new context.CancelError('Message Body is required!');
        }

        const parsedToEmail = toEmail.includes(',')
            ? toEmail.split(',').map(entry => ({ email: entry.trim() }))
            : [{ email: toEmail.trim() }];

        const body = {
            personalizations: [
                {
                    to: parsedToEmail,
                    subject
                }
            ],
            from: {
                email: fromEmail.trim()
            },
            content: [
                {
                    type: contentType || 'text/plain',
                    value: content
                }
            ],
            mail_settings: {
                sandbox_mode: {
                    enable: enableSandbox || false
                }
            }
        };

        if (fromName) {
            body.from.name = fromName;
        }

        if (ccEmail) {
            body.personalizations[0].cc = ccEmail
                .split(',')
                .map(entry => ({ email: entry.trim() }));
        }

        if (bccEmail) {
            body.personalizations[0].bcc = bccEmail
                .split(',')
                .map(entry => ({ email: entry.trim() }));
        }

        if (replyToEmail) {
            body.reply_to_list = replyToEmail
                .split(',')
                .map(entry => ({ email: entry.trim() }));
        }

        if (categories) {
            body.categories = categories.split(',').map(c => c.trim());
        }

        if (sendAt) {
            body.personalizations[0].send_at = Math.floor(new Date(sendAt).getTime() / 1000);
        }

        const response = await context.httpRequest({
            method: 'POST',
            url: 'https://api.sendgrid.com/v3/mail/send',
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/json'
            },
            data: body,
            validateStatus: () => true
        });

        if (response.status >= 400) {
            const errorMessage = response.data?.errors?.[0]?.message || JSON.stringify(response.data);
            throw new Error(`SendGrid API error: ${errorMessage}`);
        }

        const messageId = response.headers['x-message-id'];

        return context.sendJson({ messageId }, 'out');
    }
};
