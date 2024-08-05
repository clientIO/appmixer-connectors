'use strict';

module.exports = {

    async start(context) {

        let lock;
        try {
            // Lock common for all instances of this component. There can be only one process updating the config.
            lock = await context.lock('OnAnyFlowComponentError');

            // Get current WEBHOOK_FLOW_COMPONENT_ERROR from system config
            const config = await context.callAppmixer({
                endPoint: '/config',
                method: 'GET'
            });
            const urls = config.find(c => c.key === 'WEBHOOK_FLOW_COMPONENT_ERROR')?.value?.split(',') || [];
            // Use enqueueOnly to automatically enqueue the webhook in the `receive` method.
            const newUrl = context.getWebhookUrl({ enqueueOnly: true });
            const updatedUrls = [...urls, newUrl].join(',');

            await context.log({ step: 'Update config', newUrls: updatedUrls, oldUrls: urls });
            // Update WEBHOOK_FLOW_COMPONENT_ERROR in system config
            await context.callAppmixer({
                endPoint: '/config',
                method: 'POST',
                body: {
                    key: 'WEBHOOK_FLOW_COMPONENT_ERROR',
                    value: updatedUrls
                }
            });
        } finally {
            if (lock) {
                lock.unlock();
            }
        }
    },

    async stop(context) {

        try {
            // Lock common for all instances of this component. There can be only one process updating the config.
            lock = await context.lock('OnAnyFlowComponentError');

            // Get current WEBHOOK_FLOW_COMPONENT_ERROR from system config
            const config = await context.callAppmixer({
                endPoint: '/config',
                method: 'GET'
            });
            const urls = config.find(c => c.key === 'WEBHOOK_FLOW_COMPONENT_ERROR')?.value?.split(',');
            const newUrl = context.getWebhookUrl({ enqueueOnly: true });
            const updatedUrls = urls.filter(url => url !== newUrl).join(',');

            if (!updatedUrls) {
                await context.log({ step: 'Remove config' });
                // No more URLs, remove the config
                await context.callAppmixer({
                    endPoint: '/config/WEBHOOK_FLOW_COMPONENT_ERROR',
                    method: 'DELETE'
                });
                return;
            }

            await context.log({ step: 'Update config', urls: updatedUrls });
            // Update WEBHOOK_FLOW_COMPONENT_ERROR in system config
            await context.callAppmixer({
                endPoint: '/config',
                method: 'POST',
                body: {
                    key: 'WEBHOOK_FLOW_COMPONENT_ERROR',
                    value: updatedUrls
                }
            });
        } finally {
            if (lock) {
                lock.unlock();
            }
        }
    },

    async receive(context) {

        // Handle only 'component' type of error messages
        // See: https://docs.appmixer.com/appmixer/getting-started/system-webhooks
        if (context.messages.webhook?.content?.data?.type === 'component') {
            await context.sendJson(context.messages.webhook.content.data, 'out');
        }
    }
};
