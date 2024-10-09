
module.exports = {
    rules: [
        {
            limit: 50, // 50 per user per 24h
            window: 24 * 60 * 60 * 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            resource: 'manage_tweets'
        }
    ]
};
