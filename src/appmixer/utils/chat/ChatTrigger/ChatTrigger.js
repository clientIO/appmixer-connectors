'use strict';

const lib = require('../lib');
const { URL } = require('url');
const jwt = require('jsonwebtoken');

const chatScriptSnippet = `
<script>
!function(){window.AppmixerChatWidget=window.AppmixerChatWidget||{};var e=document.createElement("script");e.src="{{CHAT_WIDGET_SCRIPT_URL}}",e.async=!0,document.head.appendChild(e)}();
window.AppmixerChatWidget.chatUrl = "{{CHAT_URL}}";  // append ?chat_token={YOUR_JWT_TOKEN} to this URL if you're using JWT tokens to authenticate users of the chat.
window.AppmixerChatWidget.widgetPosition = 'bottom-right'; // or 'bottom-left'
window.AppmixerChatWidget.widgetWidth = '50%';
</script>
`;

module.exports = {

    async start(context) {

        const config = {
            name: context.properties.agentName || 'Agent',
            avatar: context.properties.agentAvatar || 'https://img.freepik.com/premium-vector/avatar-icon002_750950-52.jpg',
            message: context.properties.agentMessage || 'Hello! How can I help you?'
        };

        const agents = await context.callAppmixer({
            endPoint: '/plugins/appmixer/utils/chat/agents?flowId=' + context.flowId + '&componentId=' + context.componentId,
            method: 'GET'
        });

        let agent;
        if (agents.length) {
            agent = agents[0];
            // Update the existing agent with possible new properties.
            await context.callAppmixer({
                endPoint: '/plugins/appmixer/utils/chat/agents/' + agent.id,
                method: 'PUT',
                body: config
            });
        } else {
            // Create a new one. This is the first time this component runs.
            agent = await context.callAppmixer({
                endPoint: '/plugins/appmixer/utils/chat/agents',
                method: 'POST',
                body: {
                    ...config,
                    componentId: context.componentId,
                    flowId: context.flowId
                }
            });
        }

        return context.saveState({ agent });
    },

    async stop(context) {

        const agent = context.stateGet('agent');

        await context.callAppmixer({
            endPoint: '/plugins/appmixer/utils/chat/agents/' + agent.id,
            method: 'DELETE'
        });

        return context.stateClear();
    },

    async receive(context) {

        if (context.properties.generateInspector) {
            const parsedUrl = new URL(context.getWebhookUrl());
            const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
            return context.sendJson({
                inputs: {
                    url: {
                        label: 'Chat URL',
                        type: 'text',
                        readonly: true,
                        defaultValue: context.getWebhookUrl(),
                        tooltip: 'Open this URL in a browser to start a chat session.'
                    },
                    script: {
                        label: 'Chat Script',
                        type: 'text',
                        readonly: true,
                        defaultValue: chatScriptSnippet
                            .replace('{{CHAT_URL}}', context.getWebhookUrl())
                            .replace('{{CHAT_WIDGET_SCRIPT_URL}}', `${baseUrl}/plugins/appmixer/utils/chat/assets/chat.widget.js`),
                        tooltip: 'Add this script to your website to embed the chat widget.'
                    }
                }
            }, 'out');
        }

        if (context.messages.webhook) {

            const req = context.messages.webhook.content;
            await context.log({ step: 'webhook', req });
            const action = req.query.action;
            let jwtPayload = {};
            let jwtToken;

            const publicKey = context.properties.publicKey;
            // Note that by checking the action, we exclude loading of the chat main page.
            if (action && publicKey) {
                // Verify JWT token.
                jwtToken = req.headers['x-appmixer-chat-token'];
                if (!jwtToken) {
                    return context.response({}, 401, { 'Content-Type': 'application/json' });
                }
                try {
                    jwtPayload = jwt.verify(jwtToken, publicKey);
                } catch (err) {
                    return context.response({}, 401, { 'Content-Type': 'application/json' });
                }
            }

            switch (action) {

                case 'ensure-session': {

                    const agent = await context.stateGet('agent');
                    // Use the session ID from the JWT token if available.
                    let sessionId = jwtPayload.session_id || req.query.session_id;

                    if (sessionId) {
                        // Return threads and agents.
                        const session = await context.callAppmixer({
                            endPoint: '/plugins/appmixer/utils/chat/sessions/' + sessionId,
                            method: 'GET'
                        });
                        if (session) {
                            session.agents = [agent];
                            return context.response(session, 200, { 'Content-Type': 'application/json' });
                        }
                    }

                    // Create a session and return threads and agents.
                    const session = await context.callAppmixer({
                        endPoint: '/plugins/appmixer/utils/chat/sessions',
                        method: 'POST',
                        body: {
                            id: sessionId
                        }
                    });
                    const thread = await context.callAppmixer({
                        endPoint: '/plugins/appmixer/utils/chat/threads',
                        method: 'POST',
                        body: {
                            agentId: agent.id,
                            sessionId: session.id,
                            theme: req.data?.theme || context.properties.chatTheme || 'Ask me anything'
                        }
                    });
                    session.threads = [thread];
                    session.agents = [agent];
                    return context.response(session, 200, { 'Content-Type': 'application/json' });
                }
                case 'add-thread': {
                    // Add a new thread to the session and return it.
                    const threadData = req.data;
                    const thread = await context.callAppmixer({
                        endPoint: '/plugins/appmixer/utils/chat/threads',
                        method: 'POST',
                        body: threadData
                    });
                    await context.log({ step: 'thread-created', thread });
                    return context.response(thread, 200, { 'Content-Type': 'application/json' });
                }
                case 'delete-thread': {
                    // Add a new thread to the session and return it.
                    const { threadId } = req.data;
                    await context.callAppmixer({
                        endPoint: '/plugins/appmixer/utils/chat/threads/' + threadId,
                        method: 'DELETE'
                    });
                    await context.log({ step: 'thread-deleted', threadId });
                    return context.response({}, 200, { 'Content-Type': 'application/json' });
                }
                case 'load-thread': {
                    // Load messages in a thread.
                    const threadId = req.query.thread_id;
                    const thread = await context.callAppmixer({
                        endPoint: '/plugins/appmixer/utils/chat/threads/' + threadId,
                        method: 'GET'
                    });
                    if (!thread) {
                        return context.response({}, 404, { 'Content-Type': 'application/json' });
                    }
                    const query = req.query.since_id ? '?sinceId=' + req.query.since_id : '';
                    const messages = await context.callAppmixer({
                        endPoint: '/plugins/appmixer/utils/chat/messages/' + threadId + query,
                        method: 'GET'
                    });
                    thread.messages = messages;
                    return context.response(thread, 200, { 'Content-Type': 'application/json' });
                }
                case 'send-message': {
                    // Send a message to a thread.
                    const messageData = req.data;
                    const message = await context.callAppmixer({
                        endPoint: '/plugins/appmixer/utils/chat/messages/' + messageData.threadId,
                        method: 'POST',
                        body: {
                            content: messageData.content,
                            role: 'user',
                            componentId: context.componentId,
                            flowId: context.flowId
                        }
                    });
                    const out = {
                        ...message,
                        sessionId: req.query.session_id
                    };
                    if (jwtPayload) {
                        out.jwtPayload = jwtPayload;
                        out.jwtToken = jwtToken;
                    }
                    await context.sendJson(out, 'out');
                    return context.response(message, 200, { 'Content-Type': 'application/json' });
                }
                default:
                    // Main page.
                    const page = lib.generateWebUI(context.getWebhookUrl());
                    return context.response(page, 200, { 'Content-Type': 'text/html' });
            }
        }
    }
};
