const { URL } = require('url');
const fs = require('fs').promises;
const Redis = require('ioredis');

const page = (baseUrl, endpoint) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
        <link rel="stylesheet" href="${baseUrl}/plugins/appmixer/utils/chat/assets/chat.lib.css"/>
        <link rel="stylesheet" href="${baseUrl}/plugins/appmixer/utils/chat/assets/chat.main.css"/>
        </head>
        <body>
        <div id="chat-container"></div>
        <script type="text/javascript" src="${baseUrl}/plugins/appmixer/utils/chat/assets/chat.lib.js"></script>
        <script type="text/javascript">
           const ENDPOINT = '${endpoint}';
           const BASE_URL = '${baseUrl}';
        </script>
        <script type="text/javascript" src="${baseUrl}/plugins/appmixer/utils/chat/assets/chat.main.js"></script>
        </body>
        </html>
        `;
};

module.exports = {

    generateWebUI: function(endpoint) {

        const parsedUrl = new URL(endpoint);
        const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
        return page(baseUrl, endpoint);
    },

    connectRedis: async function() {

        const connection = {
            uri: process.env.REDIS_URI,
            mode: process.env.REDIS_MODE || 'standalone',
            sentinels: process.env.REDIS_SENTINELS,
            sentinelMasterName: process.env.REDIS_SENTINEL_MASTER_NAME,
            sentinelRedisPassword: process.env.REDIS_SENTINEL_PASSWORD,
            enableTLSForSentinelMode: process.env.REDIS_SENTINEL_ENABLE_TLS,
            caPath: process.env.REDIS_CA_PATH,
            useSSL: process.env.REDIS_USE_SSL === 'true' || parseInt(process.env.REDIS_USE_SSL) > 0
        };

        const options = {};
        if (connection.useSSL) {
            options.tls = {
                ca: connection.caPath ? await fs.readFile(connection.caPath) : undefined
            };
        }

        let client;

        if (connection.mode === 'replica' && connection.sentinels) {

            const sentinelsArray = connection.sentinels.split(',');

            client = new Redis({
                sentinels: sentinelsArray,
                name: connection.sentinelMasterName,
                ...(connection.sentinelRedisPaswword ? { password: connection.sentinelRedisPaswword } : {}),
                ...(connection.enableTLSForSentinelMode ?
                    { enableTLSForSentinelMode: connection.enableTLSForSentinelMode } : {})
            });
        } else {
            client = connection.uri ? new Redis(connection.uri, options) : new Redis();
        }

        return client;
    }
};
