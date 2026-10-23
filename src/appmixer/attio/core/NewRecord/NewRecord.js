'use strict';

const lib = require('../../lib');

const EVENT_TYPE = 'record.created';

function toOutput(record, actor) {
    return { ...record, actor };
}

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
                const { object_id: objectId, record_id: recordId } = event.id || {};
                let record;
                try {
                    record = await lib.getRecord(context, objectId, recordId);
                } catch (err) {
                    // The record was deleted before we could read it.
                    if (lib.isNotFound(err)) continue;
                    throw err;
                }
                await context.sendJson(toOutput(record, lib.actorOfEvent(event)), 'out');
            }
            return context.response();
        }
    },

    async test(context) {

        const { objectId } = context.properties;
        const [record] = await lib.latestRecords(context, objectId, 1);
        if (!record) {
            throw new context.CancelError('There are no records of this object yet. Create one in Attio to get test data.');
        }
        return context.sendJson(toOutput(record, lib.actorFromValues(record.rawValues)), 'out');
    }
};
