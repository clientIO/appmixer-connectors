'use-strict';

module.exports = {
    async receive(context) {
        const {
            to,
            subject,
            htmlContent,
            textContent,
            senderEmail,
            senderName,
            replyToEmail,
            replyToName,
            cc,
            bcc } = context.messages.in.content;

        const toArr = to.ADD.map((recipient) => {
            return {
                name: recipient.name,
                email: recipient.email
            };
        });

        const ccArr = cc.ADD.map((recipient) => {
            return {
                name: recipient.name,
                email: recipient.email
            };
        });

        const bccArr = bcc.ADD.map((recipient) => {
            return {
                name: recipient.name,
                email: recipient.email
            };
        });

        // https://developers.brevo.com/reference/sendtransacemail
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.brevo.com/v3/smtp/email',
            headers: {
                'api-key': `${context.auth.apiKey}`
            },
            data: {
                to: toArr,
                cc: ccArr,
                bcc: bccArr,
                htmlContent,
                replyTo: {
                    name: replyToName,
                    email: replyToEmail
                },
                sender: {
                    name: senderName,
                    email: senderEmail
                },
                subject,
                textContent
            }
        });

        return context.sendJson(data, 'out');
    }
};
