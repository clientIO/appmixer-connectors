'use strict';
const Shopify = require('shopify-api-node');
const pathModule = require('path');

const pager = async ({ shopify, target, operation, params = {} }) => {

    const currentPage = await shopify[target][operation](params);
    if (
        currentPage.length === 0 ||
        currentPage.length < (params.limit || 250) ||
        !currentPage.nextPageParameters
    ) {
        return currentPage;
    }

    params = currentPage.nextPageParameters;
    const nextPage = await pager({
        shopify,
        target,
        operation,
        params
    });
    return currentPage.concat(nextPage);
};

module.exports = {

    /**
     * Get Shopify API
     * @param {Object} auth
     * @returns {Shopify}
     */
    getShopifyAPI(auth) {

        return new Shopify({
            shopName: auth.store,
            accessToken: auth.accessToken,
            apiVersion: '2023-04'
        });
    },

    /**
     * Process items to find newly added.
     * @param {Set} knownItems
     * @param {Set} actualItems
     * @param {Set} newItems
     * @param {Object} item
     */
    processItems(knownItems, actualItems, newItems, item) {

        if (knownItems && !knownItems.has(item['id'])) {
            newItems.add(item);
        }
        actualItems.add(item['id']);
    },

    pager,

    /**
     * Create webhook.
     * @param {Context} context
     * @param {string} topic
     * @returns {Promise<*>}
     */
    async registerWebhook(context, topic) {

        const shopify = this.getShopifyAPI(context.auth);
        const address = context.getWebhookUrl();

        const webhooks =  await shopify.webhook.list({ address });

        let response;
        if (Array.isArray(webhooks) && webhooks.length > 0) {
            response = webhooks[0];
        } else {
            response = await shopify.webhook.create({ address, topic });
        }

        return context.saveState({ webhookId: response.id });
    },

    /**
     * Recieve data from webhook.
     * @param {Context} context
     * @param {string} port
     * @returns {Promise<*>}
     */
    async onReceive(context, port) {

        const { headers, data } = context.messages.webhook.content;

        data.webhookTopic = headers['x-shopify-topic'];
        await context.sendJson(data, port);

        return context.response();
    },

    /**
     * Delete webhook.
     * @param {Context} context
     * @returns {Promise<*>}
     */
    async unregisterWebhook(context) {

        const shopify = this.getShopifyAPI(context.auth);
        const { webhookId } = await context.loadState();

        if (webhookId) {
            return shopify.webhook.delete(webhookId);
        }
    },

    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'array', records = [] }) {
        if (outputType === 'object') {
            // One by one.
            await context.sendArray(records, outputPortName);
        } else if (outputType === 'array') {
            // All at once.
            await context.sendJson({ result: records }, outputPortName);
        } else if (outputType === 'file') {
            // Into CSV file.
            const csvString = toCsv(records);

            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || EXPORT_NAME}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);

            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    }

};

const EXPORT_NAME = 'shopify-export';

const toCsv = (array) => {
    const headers = Object.keys(array[0]);

    return [
        headers.join(','),

        ...array.map(items => {
            return Object.values(items).map(property => {
                if (typeof property === 'object') {
                    property = JSON.stringify(property);
                    // Make stringified JSON valid CSV value.
                    property = property.replace(/"/g, '""');
                }
                return `"${property}"`;
            }).join(',');
        })

    ].join('\n');
};
