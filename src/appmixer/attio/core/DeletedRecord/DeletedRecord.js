'use strict';

const lib = require('../../lib');

const EVENT_TYPE = 'record.deleted';

module.exports = {

    async start(context) {

        const { objectId } = context.properties;
        const objectUuid = await lib.resolveObjectId(context, objectId);
        return lib.startWebhookTrigger(context, EVENT_TYPE, lib.equalsFilter('id.object_id', objectUuid));
    },

    async stop(context) {

        return lib.stopWebhookTrigger(context);
    },

    async receive(context) {

        if (context.messages.webhook) {
            const events = await lib.getWebhookEvents(context, EVENT_TYPE);
            for (const event of events) {
                const id = event.id || {};
                await context.sendJson({
                    id: id.record_id,
                    objectId: id.object_id,
                    workspaceId: id.workspace_id,
                    actor: lib.actorOfEvent(event)
                }, 'out');
            }
            return context.response();
        }
    },

    async test(context) {

        // A deleted record cannot be read back from the API, so there is no real sample.
        throw new context.CancelError('Deleted records cannot be fetched from Attio. Delete a record of this object to trigger the component.');
    }
};
