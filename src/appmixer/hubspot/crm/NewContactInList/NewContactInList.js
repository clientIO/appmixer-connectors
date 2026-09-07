'use strict';
const Hubspot = require('../../Hubspot');
const { getObjectProperties } = require('../../commons');

// Default polling interval: 5 minutes
const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;
// HubSpot's batch/read endpoint accepts at most 100 inputs per call.
const BATCH_READ_CHUNK_SIZE = 100;

async function resolveProperties(context, hubspot) {

    const { properties } = context.properties;
    if (!properties) {
        return getObjectProperties(context, hubspot, 'contacts', 'names');
    }
    return properties.split(',');
}

async function readContactsBatch(hubspot, ids, properties) {

    const contacts = [];
    for (let i = 0; i < ids.length; i += BATCH_READ_CHUNK_SIZE) {
        const chunk = ids.slice(i, i + BATCH_READ_CHUNK_SIZE);
        const { data } = await hubspot.call('post', 'crm/v3/objects/contacts/batch/read', {
            inputs: chunk.map((id) => ({ id })),
            properties
        });
        if (data.results?.length) {
            contacts.push(...data.results);
        }
    }
    return contacts;
}

module.exports = {

    async start(context) {

        // Seed the join-time watermark to now so members already in the list are treated as
        // already-seen and are not emitted on the first poll.
        const now = Date.now();
        await context.saveState({ lastJoinedAt: now });
        return context.setTimeout({}, context.config?.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS);
    },

    async stop(context) {
        // Nothing to clean up for a polling trigger.
    },

    async receive(context) {

        if (!context.messages.timeout) {
            return;
        }

        const { listId } = context.properties;

        try {
            const hubspot = new Hubspot(context.auth.accessToken);
            const state = context.state || {};
            const lastJoinedAt = state.lastJoinedAt || Date.now();

            const propertiesToReturn = await resolveProperties(context, hubspot);

            // Page through list members newest-first by join time. Stop as soon as we reach a member
            // that joined at or before the watermark — everything older has already been seen. This
            // keeps the poll O(new members) and the state O(1) instead of re-scanning the whole list
            // and serializing an ever-growing seen-set on every tick.
            let newRecordIds = [];
            let newLastJoinedAt = lastJoinedAt;
            let after = undefined;
            let done = false;

            do {
                const params = { limit: 100 };
                if (after) {
                    params.after = after;
                }
                const { data } = await hubspot.call(
                    'get',
                    `crm/v3/lists/${listId}/memberships/join-order`,
                    params
                );

                const results = data.results || [];
                after = data.paging?.next?.after;

                for (const record of results) {
                    const joinedAt = new Date(record.membershipTimestamp).getTime();
                    if (joinedAt > lastJoinedAt) {
                        newRecordIds.push(String(record.recordId));
                        if (joinedAt > newLastJoinedAt) {
                            newLastJoinedAt = joinedAt;
                        }
                    } else {
                        // Ordered newest-first; once we hit an already-seen member we're done.
                        done = true;
                        break;
                    }
                }

                if (!results.length) {
                    done = true;
                }
            } while (after && !done);

            // Fetch full contact data for new members, oldest first so downstream components process
            // them in chronological order. Chunk to HubSpot's 100-input batch/read limit so a large
            // influx of new members doesn't 400 the whole poll.
            if (newRecordIds.length) {
                newRecordIds.reverse();
                const contacts = await readContactsBatch(hubspot, newRecordIds, propertiesToReturn);
                if (contacts.length) {
                    await context.sendArray(contacts, 'contact');
                }
            }

            // Advance the watermark only after a successful emit, so a failure is retried next poll
            // instead of silently swallowing contacts that were already marked seen.
            await context.saveState({ lastJoinedAt: newLastJoinedAt });

        } catch (err) {
            await context.log({ step: 'hubspot-new-contact-in-list-poll-error', listId, error: err.message });
        } finally {
            // Always reschedule so one failed poll self-heals instead of permanently killing the trigger.
            await context.setTimeout({}, context.config?.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS);
        }
    },

    async test(context) {

        const { listId } = context.properties;
        const hubspot = new Hubspot(context.auth.accessToken);

        // Newest member of the configured list, read through the same batch/read
        // path receive() uses so the emitted shape is identical.
        const { data } = await hubspot.call('get', `crm/v3/lists/${listId}/memberships/join-order`, { limit: 1 });
        const record = data.results && data.results[0];
        if (!record) {
            throw new context.CancelError('The selected list has no members to use as test data.');
        }

        const properties = await resolveProperties(context, hubspot);
        const [contact] = await readContactsBatch(hubspot, [String(record.recordId)], properties);
        if (!contact) {
            throw new context.CancelError('Could not read the latest list member to use as test data.');
        }

        return context.sendJson(contact, 'contact');
    }
};
