// curl -XGET \
//     -H "Authorization: Bearer ACCESS_TOKEN" \
// "https://APPMIXER_TENANT_API_URL/plugins/appmixer/ai/mcptools/gateways"

const { PassThrough } = require('stream');
const jwt = require('jsonwebtoken');

// In-memory map of connected SSE clients per user ID.
const sseClients = new Map();

async function publish(channel, event) {

    const redisPub = process.CONNECTOR_STREAM_PUB_CLIENT;
    if (redisPub) {
        return redisPub.publish(channel, JSON.stringify(event));
    }
}

module.exports = (context) => {

    // assert(Redis clients have been connected in plugin.js).
    process.CONNECTOR_STREAM_SUB_CLIENT.psubscribe('stream:mcp:events:*');
    process.CONNECTOR_STREAM_SUB_CLIENT.on('pmessage', async (pattern, channel, payload) => {
        if (pattern !== 'stream:mcp:events:*') {
            return; // Ignore messages not matching the expected pattern.
        }
        const [, , ,userId] = channel.split(':'); // e.g., 'stream:mcp:events:123'

        await context.log('info', `[AI.MCPTOOLS] Received event on channel ${channel} pattern ${pattern} for user ${userId}: ${JSON.stringify(Array.from(sseClients.entries()))}`);
        if (sseClients.has(userId)) {
            for (const stream of sseClients.get(userId)) {
                if (!stream.writableEnded) {
                    stream.write(`data: ${payload}\n\n`);
                }
            }
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/gateways',
        options: {
            auth: {
                strategies: ['jwt-strategy']
            },
            handler: async (req) => {
                const user = await context.http.auth.getUser(req);
                const userId = user.getId();

                // Get all MCP Gateways for this user.
                const components = await context.service.stateGet(`user:${userId}`) || [];
                return components;
            }
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/gateways',
        options: {
            auth: {
                strategies: ['jwt-strategy']
            },
            handler: async (req) => {
                const user = await context.http.auth.getUser(req);
                const userId = user.getId();

                await publish(`stream:mcp:events:${userId}`, {
                    type: 'gateway-add',
                    data: req.payload
                });
                return {};
            }
        }
    });

    context.http.router.register({
        method: 'DELETE',
        path: '/gateways/{gatewayId}',
        options: {
            auth: {
                strategies: ['jwt-strategy']
            },
            handler: async (req) => {
                const user = await context.http.auth.getUser(req);
                const userId = user.getId();
                const gatewayId = req.params.gatewayId;

                await publish(`stream:mcp:events:${userId}`, {
                    type: 'gateway-delete',
                    id: gatewayId,
                    data: req.payload
                });
                return {};
            }
        }
    });

    // SSE
    context.http.router.register({
        method: 'GET',
        path: '/events',
        options: {
            auth: {
                strategies: ['public']
            },
            handler: async (request, h) => {

                const token = request.query.token;
                const jwtSecret = await context.db.coreCollection('config').findOne({ type: 'JWTSecret' });
                const decodedToken = jwt.verify(token, jwtSecret.value);
                const userId = decodedToken.sub;

                await context.log('info', `[AI.MCPTOOLS] SSE connection request for user ${userId}. headers: ${JSON.stringify(request.headers)}`);

                const stream = new PassThrough();
                const response = h.response(stream);
                response.type('text/event-stream');
                response.header('Cache-Control', 'no-cache');
                response.header('Connection', 'keep-alive');
                // Force raw, uncompressed output.
                // This is necessary to avoid the ERR_INCOMPLETE_CHUNKED_ENCODING error.
                // It essentially disables response compression which interfers with
                // streaming behaviour.
                response.header('Content-Encoding', 'identity');
                stream.write(': init\n\n'); // Send SSE comment to kickstart stream.

                // Track connection.
                if (!sseClients.has(userId)) sseClients.set(userId, new Set());
                sseClients.get(userId).add(stream);

                await context.log('info', `[AI.MCPTOOLS] SSE connection for user ${userId} established. ${JSON.stringify(Array.from(sseClients.entries()))}`);

                // Necessary to keep the connection alive. Otherwise it closes after
                // a timeout interval set on the load balancer/proxy (typically 1 minute).
                const heartbeat = setInterval(() => {
                    if (!stream.writableEnded) {
                        stream.write(': ping\n\n');
                    }
                }, context.config.SSE_HEARTBEAT_INTERVAL || 15000);

                // Cleanup on disconnect.
                request.raw.req.on('close', async () => {
                    clearInterval(heartbeat);
                    sseClients.get(userId).delete(stream);
                    if (sseClients.get(userId).size === 0) sseClients.delete(userId);
                    stream.end();
                    await context.log('info', `[AI.MCPTOOLS] SSE connection for user ${userId} closed. ${JSON.stringify(Array.from(sseClients.entries()))}`);
                });

                return response;
            }
        }
    });
};
