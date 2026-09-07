'use strict';

module.exports = {

    rules: [
        {
            // Telegram's documented ceiling is ~30 messages per second across all chats.
            // Stay just under it so a burst of sends cannot trip the bot's flood control,
            // which answers with 429 + retry_after and can escalate to a temporary ban.
            limit: 25,
            window: 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'requests',
            scope: 'userId'
        }
        // Telegram also caps group chats at ~20 messages per minute, but that limit is
        // per chat and the quota manager has no per-chat scope. Enforcing it globally
        // would throttle a bot that legitimately talks to many chats at once, so it is
        // left to Telegram's own flood control - lib.normalizeError surfaces retry_after.
    ]
};
