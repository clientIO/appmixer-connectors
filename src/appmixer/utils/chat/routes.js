'use strict';

// curl -XPOST \
//     -H 'Content-Type: application/json' \
//     -H "Authorization: Bearer ACCESS_TOKEN" \
//     -d '{
//         "id": "msg123", 
//         "content": "Hi, what's the capital of Czechia?",
//         "role": "user",
//         "flowId": "flow123",
//         "componentId": "comp123",
//         "chatId": "chat123",
//         "userId": "user123"
//      }' \
// "https://APPMIXER_TENANT_API_URL/plugins/appmixer/utils/chat/messages/{CHAT_ID}"

const fs = require('fs');
const uuid = require('uuid');

const chatLibJs = fs.readFileSync(__dirname + '/chat.lib.js', 'utf8');
const chatMainJs = fs.readFileSync(__dirname + '/chat.main.js', 'utf8');
const chatLibCss = fs.readFileSync(__dirname + '/chat.lib.css', 'utf8');
const chatMainCss = fs.readFileSync(__dirname + '/chat.main.css', 'utf8');

module.exports = (context) => {

    const ChatMessage = require('./ChatMessageModel')(context);
    const ChatSession = require('./ChatSessionModel')(context);
    const ChatAgent = require('./ChatAgentModel')(context);
    const ChatThread = require('./ChatThreadModel')(context);

    // ASSETS

    context.http.router.register({
        method: 'GET',
        path: '/assets/chat.lib.js',
        options: {
            auth: false,
            handler: async (req, h) => {
                return h.response(chatLibJs).type('text/javascript');
            }
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/assets/chat.lib.css',
        options: {
            auth: false,
            handler: async (req, h) => {
                return h.response(chatLibCss).type('text/css');
            }
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/assets/chat.main.js',
        options: {
            auth: false,
            handler: async (req, h) => {
                return h.response(chatMainJs).type('text/javascript');
            }
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/assets/chat.main.css',
        options: {
            auth: false,
            handler: async (req, h) => {
                return h.response(chatMainCss).type('text/css');
            }
        }
    });

    // MESSAGES

    context.http.router.register({
        method: 'POST',
        path: '/messages/{threadId}',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {
                const { threadId } = req.params;
                const user = await context.http.auth.getUser(req);
                const userId = user.getId();
                // { id, content, role, flowId, componentId }
                const message = req.payload;
                message.threadId = threadId;
                message.createdAt = new Date;
                message.userId = userId;
                return new ChatMessage().populate(message).save();
            }
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/messages/{threadId}',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {
                const { threadId } = req.params;
                const user = await context.http.auth.getUser(req);
                const userId = user.getId();
                // TODO: pagination.
                const query = { threadId, userId };
                const options = { sort: { createdAt: 1 } };
                const messages = await ChatMessage.find(query, options);
                return messages;
            }
        }
    });

    context.http.router.register({
        method: 'DELETE',
        path: '/messages/{threadId}',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {
                const { threadId } = req.params;
                const user = await context.http.auth.getUser(req);
                const userId = user.getId();
                await ChatMessage.delete({ threadId, userId });
                return {};
            }
        }
    });

    // SESSIONS

    context.http.router.register({
        method: 'GET',
        path: '/sessions/{sessionId}',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {
                const { sessionId } = req.params;
                const user = await context.http.auth.getUser(req);
                const userId = user.getId();
                const query = { id: sessionId, userId };
                const session = await ChatSession.findOne(query);
                if (!session) return null;
                const threads = await ChatThread.find({ sessionId });
                session.threads = threads;
                return session;
            }
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/sessions',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {
                const session = req.payload;
                const user = await context.http.auth.getUser(req);
                session.id = uuid.v4();
                session.userId = user.getId();
                session.createdAt = new Date;
                return new ChatSession().populate(session).save();
            }
        }
    });

    // THREADS

    context.http.router.register({
        method: 'GET',
        path: '/threads/{threadId}',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {
                const { threadId } = req.params;
                const query = { id: threadId };
                const thread = await ChatThread.findOne(query);
                return thread;
            }
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/threads',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {
                const thread = req.payload;
                const user = await context.http.auth.getUser(req);
                const userId = user.getId();
                thread.id = uuid.v4();
                thread.createdAt = new Date;
                thread.userId = userId;
                return new ChatThread().populate(thread).save();
            }
        }
    });

    context.http.router.register({
        method: 'DELETE',
        path: '/threads/{threadId}',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {
                const { threadId } = req.params;
                await ChatThread.deleteById(threadId);
                return {};
            }
        }
    });

    // AGENTS

    context.http.router.register({
        method: 'GET',
        path: '/agents/{agentId}',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {
                const { agentId } = req.params;
                const user = await context.http.auth.getUser(req);
                const userId = user.getId();
                const query = { id: agentId, userId };
                const agent = await ChatAgent.findOne(query);
                return agent;
            }
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/agents',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {
                const agent = req.payload;
                const user = await context.http.auth.getUser(req);
                agent.id = uuid.v4();
                agent.userId = user.getId();
                agent.createdAt = new Date;
                return new ChatAgent().populate(agent).save();
            }
        }
    });

    context.http.router.register({
        method: 'DELETE',
        path: '/agents/{agentId}',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req) => {
                const { agentId } = req.params;
                const user = await context.http.auth.getUser(req);
                const userId = user.getId();
                await ChatAgent.delete({ id, userId });
                return {};
            }
        }
    });
};
