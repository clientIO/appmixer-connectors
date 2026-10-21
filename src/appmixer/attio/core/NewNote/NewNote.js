'use strict';

const lib = require('../../lib');

const EVENT_TYPE = 'note.created';

function toOutput(note, actor) {
    return { ...note, actor };
}

module.exports = {

    async start(context) {

        const { objectId } = context.properties;
        let filter = null;
        if (objectId) {
            const objectUuid = await lib.resolveObjectId(context, objectId);
            filter = lib.equalsFilter('parent_object_id', objectUuid);
        }
        return lib.startWebhookTrigger(context, EVENT_TYPE, filter);
    },

    async stop(context) {

        return lib.stopWebhookTrigger(context);
    },

    async receive(context) {

        if (context.messages.webhook) {
            const events = await lib.getWebhookEvents(context, EVENT_TYPE);
            for (const event of events) {
                const { note_id: noteId } = event.id || {};
                let note;
                try {
                    const { data } = await lib.apiRequest(context, { path: '/v2/notes/' + encodeURIComponent(noteId) });
                    note = lib.mapNote(data);
                } catch (err) {
                    // The note was deleted before we could read it.
                    if (lib.isNotFound(err)) continue;
                    throw err;
                }
                await context.sendJson(toOutput(note, lib.actorOfEvent(event)), 'out');
            }
            return context.response();
        }
    },

    async test(context) {

        const { objectId } = context.properties;
        const params = { limit: 1 };
        if (objectId) params.parent_object = objectId;
        const { data } = await lib.apiRequest(context, { path: '/v2/notes', params });
        const note = (data || [])[0];
        if (!note) {
            throw new context.CancelError('There are no notes yet. Create a note in Attio to get test data.');
        }
        const mapped = lib.mapNote(note);
        return context.sendJson(toOutput(mapped, { type: mapped.createdByActorType, id: mapped.createdByActorId }), 'out');
    }
};
