'use strict';

module.exports = {

    async start(context) {

        // Get current WEBHOOK_FLOW_COMPONENT_ERROR from system config
        const config = await context.callAppmixer({
            endPoint: '/config',
            method: 'GET'
        });
        const urls = config.find(c => c.key === 'WEBHOOK_FLOW_COMPONENT_ERROR')?.value?.split(',') || [];
        // Use enqueueOnly to automatically enqueue the webhook
        const newUrl = context.getWebhookUrl({ enqueueOnly: true });
        const updatedUrls = [...urls, newUrl].join(',');

        await context.log({ step: 'update config', newUrls: updatedUrls, oldUrls: urls });
        // Update WEBHOOK_FLOW_COMPONENT_ERROR in system config
        await context.callAppmixer({
            endPoint: '/config',
            method: 'POST',
            body: {
                key: 'WEBHOOK_FLOW_COMPONENT_ERROR',
                value: updatedUrls
            }
        });
    },

    async stop(context) {

        // Get current WEBHOOK_FLOW_COMPONENT_ERROR from system config
        const config = await context.callAppmixer({
            endPoint: '/config',
            method: 'GET'
        });
        const urls = config.find(c => c.key === 'WEBHOOK_FLOW_COMPONENT_ERROR')?.value?.split(',');
        const newUrl = context.getWebhookUrl();
        const updatedUrls = urls.filter(url => url !== newUrl).join(',');

        if (!updatedUrls) {
            await context.log({ step: 'remove config' });
            // No more URLs, remove the config
            await context.callAppmixer({
                endPoint: '/config/WEBHOOK_FLOW_COMPONENT_ERROR',
                method: 'DELETE'
            });
            return;
        }

        await context.log({ step: 'update config', urls: updatedUrls });
        // Update WEBHOOK_FLOW_COMPONENT_ERROR in system config
        await context.callAppmixer({
            endPoint: '/config',
            method: 'POST',
            body: {
                key: 'WEBHOOK_FLOW_COMPONENT_ERROR',
                value: updatedUrls
            }
        });
    },

    async receive(context) {

        // Handle only 'component' type of error messages
        // See: https://docs.appmixer.com/appmixer/getting-started/system-webhooks
        if (context.messages.webhook?.content?.data?.type === 'component') {
            await context.sendJson(context.messages.webhook.content.data, 'out');
        }
    }
};
