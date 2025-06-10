
'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {
        const { formId, responseId } = context.messages.in.content;

        if (!formId) {
            throw new Error('Form ID is required');
        }
        
        if (!responseId) {
            throw new Error('Response ID is required');
        }

        try {
            // https://developers.google.com/forms/api/reference/rest/v1/forms.responses/get
            const { data } = await context.httpRequest({
                method: 'GET',
                url: `https://forms.googleapis.com/v1/forms/${formId}/responses/${responseId}`,
                headers: {
                    'Authorization': `Bearer ${context.auth.apiToken}`
                }
            });

            // Transform the response to match expected output
            const output = {
                responseId: data.responseId,
                createTime: data.createTime,
                lastSubmittedTime: data.lastSubmittedTime,
                respondentEmail: data.respondentEmail,
                answers: data.answers ? Object.entries(data.answers).map(([questionId, answer]) => ({
                    questionId,
                    ...answer
                })) : [],
                totalScore: data.totalScore
            };

            return context.sendJson(output, 'out');
        } catch (error) {
            if (error.response?.status === 404) {
                throw new Error(`Response with ID '${responseId}' not found in form '${formId}'`);
            }
            throw new Error(`Failed to get response: ${error.response?.data?.error?.message || error.message}`);
        }
    }
};
