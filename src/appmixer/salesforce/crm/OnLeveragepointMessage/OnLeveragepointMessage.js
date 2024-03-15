const commons = require('../salesforce-commons');
const pick = require('lodash').pick;

module.exports = {

    async start(context) {

        await context.log({ stage: 'start', xxx: context.profileInfo });

        // register webhook in the slack plugin
        return context.service.stateAddToSet(
            context.profileInfo.organizationId || '00D7R000004wdxk',
            {
                componentId: context.componentId,
                flowId: context.flowId
            }
        );
    },

    async stop(context) {

        return context.service.stateRemoveFromSet(
            context.profileInfo.organizationId || '00D7R000004wdxk',
            {
                componentId: context.componentId,
                flowId: context.flowId
            }
        );
    },

    async receive(context) {

        await context.log({ stage: 'props', props: context.properties });
        await context.log({ stage: 'PROFILE', props: context.profileInfo });

        if (context.properties.generateInspector) {
            return generateInspector(context);
        }

        if (context.messages.webhook) {
            const data = context.messages.webhook.content.data;

            const valueProposition = (await normalizeSFObjects(context, {
                objectName: 'lpvm__Value_Proposition__c',
                items: [data]
            }))[0];

            const variables = await normalizeSFObjects(context, {
                objectName: 'lpvm__Variable__c',
                items: data.Variables || []
            });

            await context.sendJson({
                valueProposition,
                variables
            }, 'trigger');

            return context.response({
                valueProposition,
                variables
            });
        }
    }
};

function generateInspector(context) {
    return context.sendJson({
        inputs: {
            url: {
                label: 'Webhook URL',
                type: 'text',
                readonly: true,
                index: 1,
                defaultValue: context.getWebhookUrl()
            }
        }
    }, 'trigger');
}


/**
 * Normalize array of objects to list of salesforce objects. Get the available fields from salesforce and pick only those fields from the json object.
 * @param context appmixer `context` object
 * @param objectName salesforce object name
 * @param items input array of objects
 * @returns {Array}
 */
const normalizeSFObjects = async function(context, { objectName, items }) {

    const objectFields = await commons.api.getObjectFields(context, { objectName });
    return items.map(object => {
        return pick(object, objectFields.map(item => item.name));
    });
};

