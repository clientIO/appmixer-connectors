'use strict';
const FormData = require('form-data');
const { makeRequest } = require('../../commons');

module.exports = {

    async receive(context) {

        const {
            entityId,
            minorVersion,
            // Bill, BillPayment, CreditMemo, Deposit, Estimate, Invoice, JournalEntry,
            // Payment, Purchase, PurchaseOrder, RefundReceipt, SalesReceipt, TimeActivity, Transfer, VendorCredit
            entityType,
            attachment
        } = context.messages.in.content;

        // make it multipart/form-data
        const data = new FormData();

        // See https://developer.intuit.com/app/developer/qbo/docs/workflows/attach-images-and-notes#uploading-and-linking-new-attachments
        // We upload only one file and link it to the entity in the same request
        data.append('file_metadata_01', JSON.stringify({
            AttachableRef: [
                {
                    EntityRef: {
                        type: entityType,
                        value: entityId
                    }
                }
            ]
        }), {
            contentType: 'application/json; charset=UTF-8'
        });

        const fileInfo = await context.getFileInfo(attachment);
        const fileStream = await context.getFileReadStream(attachment);
        data.append('file_content_01', fileStream, {
            filename: fileInfo.filename,
            contentType: fileInfo.contentType,
            knownLength: fileInfo.length
        });

        const headers = data.getHeaders();

        const options = {
            path: `v3/company/${context.profileInfo.companyId}/upload?minorversion=${minorVersion}`,
            method: 'POST',
            headers,
            data
        };
        const response = await makeRequest({ context, options });
        console.log(response.data.AttachableResponse[0].Fault);
        console.log(response.data.AttachableResponse[0].Attachable);
        return context.sendJson(response.data?.AttachableResponse[0]?.Attachable, 'out');
    }
};
