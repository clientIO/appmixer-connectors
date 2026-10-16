/* eslint-disable camelcase */
'use strict';

const lib = require('../../lib');

const TTL_USERS = 20 * 1000; // 20 sec

// users.list max page size.
const PAGE_SIZE = 1000;

const PROFILE_SCHEMA = {
    type: 'object',
    title: 'Profile',
    properties: {
        avatar_hash: { type: 'string', title: 'Profile.Avatar Hash', example: 'g1a2b3c4d5e6' },
        status_text: { type: 'string', title: 'Profile.Status Text', example: 'In a meeting' },
        status_emoji: { type: 'string', title: 'Profile.Status Emoji', example: ':calendar:' },
        real_name: { type: 'string', title: 'Profile.Real Name', example: 'Jane Doe' },
        display_name: { type: 'string', title: 'Profile.Display Name', example: 'jane' },
        real_name_normalized: { type: 'string', title: 'Profile.Real Name Normalized', example: 'Jane Doe' },
        display_name_normalized: { type: 'string', title: 'Profile.Display Name Normalized', example: 'jane' },
        email: { type: 'string', title: 'Profile.Email', example: 'jane.doe@example.com' },
        image_24: { type: 'string', title: 'Profile.Image 24', example: 'https://avatars.slack-edge.com/u_24.jpg' },
        image_32: { type: 'string', title: 'Profile.Image 32', example: 'https://avatars.slack-edge.com/u_32.jpg' },
        image_48: { type: 'string', title: 'Profile.Image 48', example: 'https://avatars.slack-edge.com/u_48.jpg' },
        image_72: { type: 'string', title: 'Profile.Image 72', example: 'https://avatars.slack-edge.com/u_72.jpg' },
        image_192: { type: 'string', title: 'Profile.Image 192', example: 'https://avatars.slack-edge.com/u_192.jpg' },
        image_512: { type: 'string', title: 'Profile.Image 512', example: 'https://avatars.slack-edge.com/u_512.jpg' },
        team: { type: 'string', title: 'Profile.Team', example: 'T0ABC12345' }
    }
};

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'name'],
    properties: {
        id: { type: 'string', title: 'ID', example: 'U0ABC12345' },
        team_id: { type: 'string', title: 'Team ID', example: 'T0ABC12345' },
        name: { type: 'string', title: 'Name', example: 'jane' },
        deleted: { type: 'boolean', title: 'Deleted', example: false },
        color: { type: 'string', title: 'Color', example: '9f69e7' },
        real_name: { type: 'string', title: 'Real Name', example: 'Jane Doe' },
        tz: { type: 'string', title: 'Timezone', example: 'Europe/Prague' },
        tz_label: { type: 'string', title: 'Timezone Label', example: 'Central European Summer Time' },
        tz_offset: { type: 'number', title: 'Timezone Offset', example: 7200 },
        profile: PROFILE_SCHEMA,
        is_admin: { type: 'boolean', title: 'Is Admin', example: false },
        is_owner: { type: 'boolean', title: 'Is Owner', example: false },
        is_primary_owner: { type: 'boolean', title: 'Is Primary Owner', example: false },
        is_restricted: { type: 'boolean', title: 'Is Restricted', example: false },
        is_ultra_restricted: { type: 'boolean', title: 'Is Ultra Restricted', example: false },
        is_bot: { type: 'boolean', title: 'Is Bot', example: false },
        updated: { type: 'number', title: 'Updated', example: 1737024600 },
        is_app_user: { type: 'boolean', title: 'Is App User', example: false },
        has_2fa: { type: 'boolean', title: 'Has 2FA', example: false },
        locale: { type: 'string', title: 'Locale', example: 'en-US' }
    }
};

module.exports = {

    ITEM_SCHEMA,

    /**
     * @link https://api.slack.com/methods/users.list
     */
    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { outputType, isSource } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Users' });
        }

        const cacheKey = 'slack-list-users-' + context.flowId;
        let lock;
        try {
            lock = await context.lock(context.flowId, { retryDelay: 500 });

            if (isSource) {
                const usersCached = await context.staticCache.get(cacheKey);
                if (usersCached) {
                    await lib.sendArrayOutput({ context, outputType, records: usersCached });
                    return;
                }
            }

            const members = [];
            let cursor;
            do {
                const { data } = await context.httpRequest({
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${context.auth.accessToken}`
                    },
                    url: 'https://slack.com/api/users.list',
                    params: { limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }
                });

                if (!data) {
                    throw new Error('Empty response from Slack users.list');
                }
                if (!data.ok) {
                    throw new Error(data.error);
                }
                members.push(...(data.members || []));
                cursor = data.response_metadata?.next_cursor;
            } while (cursor);

            // Cache the users for 20 seconds unless specified otherwise in the config.
            // Note that we only need name and id, so we can save some space in the cache.
            // Caching only if this is a call from another component.
            if (isSource) {
                await context.staticCache.set(
                    cacheKey,
                    members.map(item => ({ id: item.id, name: item.real_name || item.name })),
                    context.config?.listUsersCacheTTL || TTL_USERS
                );
            }

            await lib.sendArrayOutput({ context, outputType, records: members });
        } catch (err) {
            if (isSource) {
                await lib.sendArrayOutput({ context, outputType, records: [] });
                return;
            }

            // Look for Slack API error message: https://api.slack.com/web#responses
            // For example: { "ok": false, "error": "ratelimited" }
            throw err.response?.data?.error || err;
        } finally {
            lock?.unlock();
        }
    }
};
