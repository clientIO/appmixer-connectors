'use strict';

const lib = require('../../lib');

const EVENT_TYPE = 'list-entry.updated';

function toOutput(entry, actor, attributeId) {
    return { ...entry, attributeId, actor };
}

module.exports = {

    async start(context) {

        const { listId } = context.properties;
        const listUuid = await lib.resolveListId(context, listId);
        return lib.startWebhookTrigger(context, EVENT_TYPE, lib.equalsFilter('id.list_id', listUuid));
    },

    async stop(context) {

        return lib.stopWebhookTrigger(context);
    },

    async receive(context) {

        if (context.messages.webhook) {
            const events = await lib.getWebhookEvents(context, EVENT_TYPE);
            for (const event of events) {
                const { list_id: listId, entry_id: entryId, attribute_id: attributeId } = event.id || {};
                let entry;
                try {
                    entry = await lib.getEntry(context, listId, entryId);
                } catch (err) {
                    // The entry was removed before we could read it.
                    if (lib.isNotFound(err)) continue;
                    throw err;
                }
                await context.sendJson(toOutput(entry, lib.actorOfEvent(event), attributeId), 'out');
            }
            return context.response();
        }
    },

    async test(context) {

        const { listId } = context.properties;
        const [entry] = await lib.latestEntries(context, listId, 1);
        if (!entry) {
            throw new context.CancelError('The list has no entries yet. Add a record to the list in Attio to get test data.');
        }
        return context.sendJson(toOutput(entry, lib.actorFromValues(entry.rawEntryValues), null), 'out');
    }
};
