'use strict';
const mandrill = require('mandrill-api/mandrill');

async function sendEmail(context, mailClient, recipients, subject, text, html) {

    const to = recipients.map(recipient => {
        return {
            'email': recipient,
            'type': 'to'
        };
    });

    const message = {
        to,
        from_email: context.config.fromEmail || 'no_reply@appmixer.com',
        from_name: context.config.fromName || 'Appmixer',
        subject,
        html,
        text
    };

    return new Promise((resolve, reject) => {
        mailClient.messages.send(
            { message },
            (result) => {
                if (!result) {
                    return reject('Invalid response from mandrill.');
                }
                if (['sent', 'queued', 'scheduled'].indexOf(result[0].status) > -1) {
                    return resolve(result);
                }
                reject(new Error('Email status: ' + result[0].status +
                    (result[0].status === 'rejected' ? ', reason: ' + result[0]['reject_reason'] : '')
                ));
            },
            err => {
                reject(err);
            }
        );
    });
}

async function storeResult(context, storeId, key, value) {

    return context.store.set(storeId, key, value);
}

module.exports = {

    async receive(context) {

        const API_KEY = context.config.apiKey || 'bzjR9BOFhPkojdmK_SCh1A';
        let client = new mandrill.Mandrill(API_KEY);
        const { successStoreId, failedStoreId } = context.properties;
        let { content } = context.messages.in;
        const { flowId, appmixerApiUrl } = context;
        // Hack to use the https://my.<tenant>.appmixer.com subdomain for the appmixerApiUrl instead of https://api.<tenant>.appmixer.com.
        const baseUrl = appmixerApiUrl.replace(/\/\/api\./, '//my.');
        let recipients = content.recipients.split(',');

        const { testCase, result } = content;

        const parsedResult = JSON.parse(result);

        let arrayResults = Array.isArray(parsedResult) ? parsedResult : [parsedResult];
        // Remove results without componentId (probably from cached results?)
        arrayResults = arrayResults.filter(result => result.componentId);

        const failedAsserts = arrayResults.filter(result => {
            return result.error?.length > 0;
        });

        // Metadata about the test case for HTML email content.
        const metadata = {
            name: testCase,
            url: baseUrl + '/designer/' + flowId,
            status: failedAsserts.length > 0 ? 'failed' : 'passed',
            failedAsserts: failedAsserts.length,
            totalAsserts: arrayResults.length
        };

        // If the test timed out, no need to do further inspection. Store result and send timed out email
        if (parsedResult.message === 'timed out') {
            metadata.status = 'timed out';
            metadata.failedAsserts = 'N/A';
            metadata.totalAsserts = 'N/A';
            const subject = `${testCase} timed out`;
            const text = `The ${testCase} has timed out, meaning that some components failed to deliver their messages.`
                + ' Please review the logs to find the issue.';
            const details = `
                <table>
                    <tr>
                        <th>Timed out components</th>
                    </tr>
                    ${parsedResult.timedOutLinks?.map(timedOut => `
                            <tr>
                                <td>${timedOut}</td>
                            </tr>
                        `).join('')}
                </table>`;
            await storeResult(context, failedStoreId, testCase, result);
            await sendEmail(context, client, recipients, subject, text, getHTML(metadata, details));
            return;
        }

        // Details about each Assert component for HTML email content.
        const asserts = arrayResults.map(result => {
            return {
                componentId: result.componentId,
                componentName: result.componentName || 'Assert',
                status: result.error?.length > 0 ? '❌' : '✅',
                asserts: result.error?.length,
                errors: result.error?.join('<br>'),
                link: baseUrl + '/designer/' + flowId + '/' + result.componentId
            };
        });

        // HTML content for the email
        const details = `
        <table>
            <tr>
                <th>Component</th>
                <th>Status</th>
                <th>Asserts</th>
                <th>Errors</th>
                <th>ComponentId</th>
            </tr>
            ${asserts.map(assert => `
                    <tr>
                        <td>${assert.componentName}</td>
                        <td>${assert.status}</td>
                        <td>${assert.asserts}</td>
                        <td>${assert.errors}</td>
                        <td><a href="${assert.link}">${assert.componentId}</a></td>
                    </tr>
                `).join('')}
        </table>`;

        if (failedAsserts.length > 0) {
            const subject = `${testCase} failed`;
            const text = `The following errors were found:\n\n${JSON.stringify(failedAsserts)}\n\nFull test results `
                + `were:\n\n${JSON.stringify(arrayResults)}`;
            await storeResult(context, failedStoreId, testCase, result);
            await sendEmail(context, client, recipients, subject, text, getHTML(metadata, details));
        } else {
            await storeResult(context, successStoreId, testCase, result);
        }
    }
};

function getHTML(metadata, details) {

    return `
        <html>
            <head>
                <style>
                    table {
                        border-collapse: collapse;
                    }
                    table, th, td {
                        border: 1px solid black;
                    }
                    th, td {
                        padding: 5px;
                        text-align: left;
                    }
                </style>
            </head>
            <body>
                <h1>${metadata.name}</h1>
                <table>
                    <tr>
                        <th>Name</th>
                        <td>${metadata.name}</td>
                    </tr>
                    <tr>
                        <th>URL</th>
                        <td><a href="${metadata.url}">${metadata.url}</a></td>
                    </tr>
                    <tr>
                        <th>Status</th>
                        <td>${metadata.status}</td>
                    </tr>
                    <tr>
                        <th>Failed asserts</th>
                        <td>${metadata.failedAsserts}</td>
                    </tr>
                    <tr>
                        <th>Total asserts</th>
                        <td>${metadata.totalAsserts}</td>
                    </tr>
                </table>
                <h2>Details</h2>
                ${details}
                </table>
            </body>
        </html>`;
}
