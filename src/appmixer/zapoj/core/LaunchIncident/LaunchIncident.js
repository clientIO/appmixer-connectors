'use strict';

module.exports = {

    async receive(context) {

        const { timeZone, incidentTemplateId, message, formTemplate } = context.messages.in.content;
        // Needed to access the Lauch API. Different authentication endpoint from the rest.
        const { zapojLaunchEmail, zapojLaunchPassword, zapojLaunchSubdomain } = context.config;

        // context.log({ step: '1', timeZone, incidentTemplateId, message, zapojLaunchEmail, zapojLaunchPassword, formTemplate });

        // 1 - Authenticate with the Launch API
        const { data: authData } = await context.httpRequest({
            url: `https://zapi-azure.${zapojLaunchSubdomain}.zapoj.com/api/login`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            data: {
                email: zapojLaunchEmail,
                password: zapojLaunchPassword
            }
        });
        // context.log({ step: '2', authData });
        const launchToken = authData.authorization?.token;

        const { data } = await context.httpRequest({
            url: `https://messagetemplate-azure.${zapojLaunchSubdomain}.zapoj.com/api/itTemplate/launchFirstPhase`,
            method: 'POST',
            headers: {
                authorization: `Bearer ${launchToken}`
            },
            data: {
                timeZone,
                incidentTemplateId,
                formTemplate: formTemplate.AND || [],
                message: {
                    recordType: 'textToSpeech',
                    emailMessageNotification: false,
                    sms: message,
                    speechType: 'textToSpeech',
                    emailNotification: false
                }
            }
        });
        // context.log({ step: '3', data });

        context.sendJson(data, 'out');
    }
};
