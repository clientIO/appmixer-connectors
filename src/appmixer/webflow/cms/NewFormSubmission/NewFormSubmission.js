'use strict';

const WEBFLOW_HEADERS = (token) => ({
    Authorization: `Bearer ${token}`,
    'accept-version': '2.0.0'
});

// Reshapes a v2 form-submission record into the `form_submission` webhook body
// that receive() forwards. The fields downstream relies on (FormDescriptor exposes
// payload.name / payload.siteId / payload.data.<field>) all come from the API record;
// webhook-only envelope fields (schema, pageId, formElementId) aren't available via
// REST and are omitted.
function toWebhookShape(submission) {
    return {
        triggerType: 'form_submission',
        payload: {
            id: submission.id,
            formId: submission.formId,
            siteId: submission.siteId,
            workspaceId: submission.workspaceId,
            name: submission.displayName,
            submittedAt: submission.dateSubmitted,
            data: submission.formResponse || {}
        }
    };
}

/**
 * Component trigger, which fires when the form is submitted from your Webflow site.
 * @extends {Component}
 */
module.exports = {

    // Flow Test Mode: fetch the most recent real form submission and reshape it into
    // the webhook body receive() emits. Honors the optional formId filter.
    async fetchLatestSubmission(context) {
        const token = context.auth.apiKey;
        const { siteId } = context.properties;
        let { formId } = context.properties;

        if (!formId) {
            // No form filter — sample from the first form on the site.
            const formsRes = await context.httpRequest({
                url: `https://api.webflow.com/v2/sites/${siteId}/forms`,
                method: 'GET',
                headers: WEBFLOW_HEADERS(token)
            });
            formId = ((formsRes.data && formsRes.data.forms) || [])[0]?.id;
            if (!formId) {
                return null;
            }
        }

        const res = await context.httpRequest({
            url: `https://api.webflow.com/v2/forms/${formId}/submissions`,
            method: 'GET',
            headers: WEBFLOW_HEADERS(token)
        });
        const submissions = (res.data && res.data.formSubmissions) || [];
        submissions.sort((a, b) => new Date(b.dateSubmitted) - new Date(a.dateSubmitted));
        return submissions[0] || null;
    },

    async test(context) {
        const submission = await this.fetchLatestSubmission(context);
        if (!submission) {
            throw new Error('No recent form submissions to use as test data.');
        }
        return context.sendJson(toWebhookShape(submission), 'out');
    },
    async registerWebhook(context, siteId, webhookCallbackUrl) {
        // Define the API endpoint and payload for registering a webhook
        const url = `https://api.webflow.com/v2/sites/${siteId}/webhooks`;
        const payload = {
            triggerType: 'form_submission',
            url: webhookCallbackUrl
        };

        // Make the HTTP request to register the webhook
        const response = await context.httpRequest({
            url,
            method: 'POST',
            headers: {
                Authorization: `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/json',
                'accept-version': '2.0.0'
            },
            data: payload
        });

        return response.data; // Return the registered webhook data
    },

    async unregisterWebhook(context) {
        const {
            state: { webhookId }
        } = context;

        if (!webhookId) {
            return;
        }

        // Define the API endpoint for deleting a webhook
        const url = `https://api.webflow.com/v2/webhooks/${webhookId}`;
        await context.httpRequest({
            url,
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/json',
                'accept-version': '2.0.0'
            }
        });

        // Clear the state after successful deletion
        await context.saveState({ webhookId: null });
    },

    async start(context) {
        const {
            properties: { siteId }
        } = context;

        // Register the webhook and save its ID in the state
        const webhookData = await this.registerWebhook(
            context,
            siteId,
            context.getWebhookUrl()
        );
        await context.saveState({ webhookId: webhookData.id });
    },

    async stop(context) {
        // Unregister the webhook using the stored ID
        await this.unregisterWebhook(context);
    },

    async receive(context) {
        const { data } = context.messages.webhook.content;

        if (context.properties.formId && data.payload.formId !== context.properties.formId) {
            // Ignore the webhook if it doesn't match the specified form
            return context.response();
        }

        // Send the form submission data to the output port
        await context.sendJson(data, 'out');
        return context.response();
    }
};
