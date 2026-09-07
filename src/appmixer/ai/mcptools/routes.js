'use strict';

// curl -XGET \
//     -H "Authorization: Bearer ACCESS_TOKEN" \
// "https://APPMIXER_TENANT_API_URL/plugins/appmixer/ai/mcptools/gateways"

const { PassThrough } = require('stream');
const jwt = require('jsonwebtoken');

module.exports = (context) => {

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
                const components = await context.service.stateGet(`mcpgateways:user:${userId}`) || [];
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

                await context.pubSubPublish(`stream:mcp:events:${userId}`, {
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
                const flowId = req.query.flowId;

                // Remove the gateway from the user's registry. `gatewayId` is the
                // component ID; pass `?flowId=` to scope the removal to one flow.
                // This is also the way to clean up registrations of flows that were
                // deleted without being stopped (MCPGateway.stop() never ran).
                const key = `mcpgateways:user:${userId}`;
                const gateways = await context.service.stateGet(key) || [];
                const remaining = gateways.filter(gateway =>
                    !(gateway.componentId === gatewayId && (!flowId || gateway.flowId === flowId)));
                const removed = gateways.length - remaining.length;
                if (removed) {
                    if (remaining.length) {
                        await context.service.stateSet(key, remaining);
                    } else {
                        await context.service.stateUnset(key);
                    }
                }

                await context.pubSubPublish(`stream:mcp:events:${userId}`, {
                    type: 'gateway-delete',
                    id: gatewayId,
                    flowId,
                    data: req.payload
                });
                return { removed };
            }
        }
    });

    // SSE — MCP clients (e.g. Claude Desktop) connect here to receive real-time
    // gateway events. Auth is done via a JWT passed as a query param because
    // browser EventSource / MCP clients cannot set custom headers.
    context.http.router.register({
        method: 'GET',
        path: '/events',
        options: {
            auth: {
                strategies: ['public']
            },
            cors: {
                origin: ['*']
            },
            handler: async (request, h) => {

                const token = request.query.token;
                if (!token) {
                    return h.response('Missing token').code(401);
                }
                let userId;
                try {
                    const jwtSecret = await context.db.coreCollection('config').findOne({ type: 'JWTSecret' });
                    const decodedToken = jwt.verify(token, jwtSecret.value);
                    userId = decodedToken.sub;
                } catch (err) {
                    return h.response('Invalid or expired token').code(401);
                }

                const stream = new PassThrough();
                const response = h.response(stream);
                response.type('text/event-stream');
                response.header('Cache-Control', 'no-cache');
                response.header('Connection', 'keep-alive');
                // Force raw, uncompressed output to avoid ERR_INCOMPLETE_CHUNKED_ENCODING.
                response.header('Content-Encoding', 'identity');
                stream.write(': init\n\n'); // Kickstart stream.

                const sendEvent = (data) => {
                    if (!stream.writableEnded) {
                        stream.write(`data: ${JSON.stringify(data)}\n\n`);
                    }
                };

                // Track subscription so the close handler can unsubscribe even if the
                // client disconnects during the subscribe await.
                let sub = null;
                let closed = false;

                const heartbeat = setInterval(() => {
                    if (!stream.writableEnded) {
                        stream.write(': ping\n\n');
                    }
                }, context.config.SSE_HEARTBEAT_INTERVAL || 15000);

                // Attach close handler BEFORE awaiting subscribe to avoid a race where
                // the client disconnects during subscribe and cleanup never runs.
                request.raw.req.on('close', () => {
                    closed = true;
                    clearInterval(heartbeat);
                    Promise.allSettled([
                        sub ? sub.unsubscribe() : Promise.resolve()
                    ]).finally(() => {
                        if (!stream.writableEnded) stream.end();
                    });
                });

                sub = await context.pubSubSubscribe(`stream:mcp:events:${userId}`, sendEvent);

                // If client disconnected during subscribe, clean up immediately.
                if (closed) {
                    await sub.unsubscribe();
                    if (!stream.writableEnded) stream.end();
                    return response;
                }

                return response;
            }
        }
    });
};
