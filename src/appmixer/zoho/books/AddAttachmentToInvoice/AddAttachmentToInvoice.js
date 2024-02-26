'use strict';
const FormData = require('form-data');
const ZohoClient = require('../../ZohoClient');

module.exports = {

    async receive(context) {

        const { invoice_id, organization_id, attachment, can_send_in_email } = context.messages.in.content;

        const data = new FormData();
        const fileInfo = await context.getFileInfo(attachment);
        const fileStream = await context.getFileReadStream(attachment);

        data.append('attachment', fileStream, {
            filename: fileInfo.filename,
            contentType: fileInfo.contentType,
            knownLength: fileInfo.length
        });

        const can_send_in_emailValue = can_send_in_email === true ? 'true' : 'false';
        data.append('can_send_in_email', can_send_in_emailValue);

        const headers = data.getHeaders();
        const params = { organization_id };

        const zc = new ZohoClient(context);
        const result = await zc.request(
            'POST',
            '/books/v3/invoices/' + invoice_id + '/attachment',
            { data, headers, params }
        );

        return context.sendJson(result, 'out');
    }
};
