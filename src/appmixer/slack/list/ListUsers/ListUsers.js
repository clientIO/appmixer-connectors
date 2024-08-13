'use strict';

const commons = require('../../slack-commons');

const outputPortName = 'out';
const TTL_USERS = 20 * 1000; // 20 sec

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        let { outputType, limit, isSource } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const cacheKey = 'slack-list-users-' + context.flowId;
        let lock;
        try {
            lock = await context.lock(context.flowId, { retryDelay: 500 });

            if (isSource) {
                const usersCached = await context.staticCache.get(cacheKey);
                if (usersCached) {
                    await commons.sendArrayOutput({ context, outputType, records: usersCached });
                    return;
                }
            }

            const { data } = await context.httpRequest({
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`
                },
                url: 'https://slack.com/api/users.list',
                params: { limit }
            });

            if (!data) {
                throw new context.CancelError(response.statusText);
            }
            if (!data.ok) {
                throw new context.CancelError(data.error);
            }

            // Cache the tables for 20 seconds unless specified otherwise in the config.
            // Note that we only need name and id, so we can save some space in the cache.
            // Caching only if this is a call from another component.
            if (isSource) {
                await context.staticCache.set(
                    cacheKey,
                    data.members?.map(item => ({ id: item.id, name: item.real_name || item.name })),
                    context.config?.listUsersCacheTTL || TTL_USERS
                );
            }

            await commons.sendArrayOutput({ context, outputType, records: data.members });
        } catch (err) {
            // Look for Slack API error message: https://api.slack.com/web#responses
            // For example: { "ok": false, "error": "ratelimited" }
            throw err.response?.data?.error || err;
        } finally {
            lock?.unlock();
        }
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'object' || outputType === 'first') {
            return context.sendJson([
                { label: 'ID', value: 'id' },
                { label: 'Team ID', value: 'team_id' },
                { label: 'Name', value: 'name' },
                { label: 'Deleted', value: 'deleted' },
                { label: 'Color', value: 'color' },
                { label: 'Real Name', value: 'real_name' },
                { label: 'Timezone', value: 'tz' },
                { label: 'Timezone Label', value: 'tz_label' },
                { label: 'Timezone Offset', value: 'tz_offset' },
                { label: 'Profile', value: 'profile', schema: {
                    type: 'object',
                    properties: {
                        avatar_hash: { type: 'string', title: 'Avatar Hash' },
                        status_text: { type: 'string', title: 'Status Text' },
                        status_emoji: { type: 'string', title: 'Status Emoji' },
                        real_name: { type: 'string', title: 'Real Name' },
                        display_name: { type: 'string', title: 'Display Name' },
                        real_name_normalized: { type: 'string', title: 'Real Name Normalized' },
                        display_name_normalized: { type: 'string', title: 'Display Name Normalized' },
                        email: { type: 'string', title: 'Email' },
                        image_24: { type: 'string', title: 'Image 24' },
                        image_32: { type: 'string', title: 'Image 32' },
                        image_48: { type: 'string', title: 'Image 48' },
                        image_72: { type: 'string', title: 'Image 72' },
                        image_192: { type: 'string', title: 'Image 192' },
                        image_512: { type: 'string', title: 'Image 512' },
                        team: { type: 'string', title: 'Team' }
                    } }
                },
                { label: 'Is Admin', value: 'is_admin' },
                { label: 'Is Owner', value: 'is_owner' },
                { label: 'Is Primary Owner', value: 'is_primary_owner' },
                { label: 'Is Restricted', value: 'is_restricted' },
                { label: 'Is Ultra Restricted', value: 'is_ultra_restricted' },
                { label: 'Is Bot', value: 'is_bot' },
                { label: 'Updated', value: 'updated' },
                { label: 'Is App User', value: 'is_app_user' },
                { label: 'Has 2FA', value: 'has_2fa' },
                { label: 'Locale', value: 'locale' }
            ], outputPortName);
        } else if (outputType === 'array') {
            return context.sendJson([
                {
                    label: 'Users',
                    value: 'array',
                    schema: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { label: 'ID', value: 'id' },
                                team_id: { label: 'Team ID', value: 'team_id' },
                                name: { label: 'Name', value: 'name' },
                                deleted: { label: 'Deleted', value: 'deleted' },
                                color: { label: 'Color', value: 'color' },
                                real_name: { label: 'Real Name', value: 'real_name' },
                                tz: { label: 'Timezone', value: 'tz' },
                                tz_label: { label: 'Timezone Label', value: 'tz_label' },
                                tz_offset: { label: 'Timezone Offset', value: 'tz_offset' },
                                profile: { label: 'Profile', value: 'profile', schema: {
                                    type: 'object',
                                    properties: {
                                        avatar_hash: { type: 'string', title: 'Avatar Hash' },
                                        status_text: { type: 'string', title: 'Status Text' },
                                        status_emoji: { type: 'string', title: 'Status Emoji' },
                                        real_name: { type: 'string', title: 'Real Name' },
                                        display_name: { type: 'string', title: 'Display Name' },
                                        real_name_normalized: { type: 'string', title: 'Real Name Normalized' },
                                        display_name_normalized: { type: 'string', title: 'Display Name Normalized' },
                                        email: { type: 'string', title: 'Email' },
                                        image_24: { type: 'string', title: 'Image 24' },
                                        image_32: { type: 'string', title: 'Image 32' },
                                        image_48: { type: 'string', title: 'Image 48' },
                                        image_72: { type: 'string', title: 'Image 72' },
                                        image_192: { type: 'string', title: 'Image 192' },
                                        image_512: { type: 'string', title: 'Image 512' },
                                        team: { type: 'string', title: 'Team' }
                                    } }
                                },
                                is_admin: { label: 'Is Admin', value: 'is_admin' },
                                is_owner: { label: 'Is Owner', value: 'is_owner' },
                                is_primary_owner: { label: 'Is Primary Owner', value: 'is_primary_owner' },
                                is_restricted: { label: 'Is Restricted', value: 'is_restricted' },
                                is_ultra_restricted: { label: 'Is Ultra Restricted', value: 'is_ultra_restricted' },
                                is_bot: { label: 'Is Bot', value: 'is_bot' },
                                updated: { label: 'Updated', value: 'updated' },
                                is_app_user: { label: 'Is App User', value: 'is_app_user' },
                                has_2fa: { label: 'Has 2FA', value: 'has_2fa' },
                                locale: { label: 'Locale', value: 'locale' }
                            }
                        }
                    }
                }
            ], outputPortName);
        } else if (outputType === 'file') {
            return context.sendJson([
                { label: 'File ID', value: 'fileId' }
            ], outputPortName);
        } else {
            // Default to array output
            return context.sendJson([], outputPortName);
        }
    }
};
