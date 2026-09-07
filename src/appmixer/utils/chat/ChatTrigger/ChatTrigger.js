'use strict';

const lib = require('../lib');
const { URL } = require('url');
const jwt = require('jsonwebtoken');

const chatScriptSnippet = `
<script type="module">
!function(){
    var e=document.createElement("script");
    e.type="module";
    e.src="{{CHAT_WIDGET_SCRIPT_URL}}",
    e.onload=function(){window.initLauncher&&initLauncher({mode:"dialog",theme:"light",endpoint:"{{CHAT_URL}}",baseUrl:"{{BASE_URL}}",jwt:"",widgetPosition:"bottom-right"})},
    document.head.appendChild(e)}();
</script>
`;

module.exports = {

    // Flow Test Mode: the 'out' port emits a live user chat message. There is no API to fetch a
    // real one and its shape is not derived from user config, so a fabricated sample would test
    // nothing and match no real run. Fail with a clear explanation instead.
    async test(context) {

        throw new context.CancelError(
            'Flow Test Mode is not available for this trigger: a chat message can only come from a '
            + 'real conversation, and there is no API to fetch one as sample data. Open the chat and '
            + 'send a message to trigger the flow instead.'
        );
    },

    async start(context) {

        const config = {
            name: context.properties.agentName,
            avatar: context.properties.agentAvatar,
            intro: context.properties.agentIntro,
            description: context.properties.agentDescription,
            promptPlaceholder: context.properties.agentPromptPlaceholder
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
                            .replace('{{BASE_URL}}', process.env.APPMIXER_API_URL)
                            .replace('{{CHAT_WIDGET_SCRIPT_URL}}', `${baseUrl}/plugins/appmixer/utils/chat/assets/chat.bundle.js`),
                        tooltip: 'Add this script to your website to embed the chat widget.'
                    }
                }
            }, 'out');
        }

        if (context.messages.webhook) {

            const req = context.messages.webhook.content;
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
                    session.agents = [agent];
                    await context.log({ step: 'session-created', session });
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
                    const chatMessage = {
                        content: messageData.content,
                        role: 'user',
                        componentId: context.componentId,
                        flowId: context.flowId
                    };

                    if (messageData.files) {
                        chatMessage.files = [];
                        for (const file of messageData.files) {
                            const appmixerFile = await context.saveFile(file.name || 'file', file.type || 'application/octet-stream', Buffer.from(file.data, 'base64'));
                            chatMessage.files.push({
                                id: appmixerFile.fileId,
                                name: appmixerFile.filename,
                                type: file.type,
                                size: appmixerFile.length,
                                md5: appmixerFile.md5
                            });
                        }
                        await context.log({ step: 'files-saved', files: chatMessage.files });
                    }

                    const message = await context.callAppmixer({
                        endPoint: '/plugins/appmixer/utils/chat/messages/' + messageData.threadId,
                        method: 'POST',
                        body: chatMessage
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
