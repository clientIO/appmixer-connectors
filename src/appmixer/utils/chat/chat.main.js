const { ChatBot } = chatbot;

let chat;
let sessionId;
let authHeader = {};

function getSessionId() {

    // Session ID associates chats and agents with the user.
    let sessions;

    // First, try to read the session ID from the URL.
    const urlParams = new URLSearchParams(window.location.search);
    sessionId = urlParams.get('session_id');
    if (sessionId) {
        return sessionId;
    }

    // If not in the URL, try to read it from the session storage.
    // Also, we need to load the proper session ID for the flowId/componentId pair since
    // sessionStorage is for the entire domain.
    try {
        sessions = JSON.parse(sessionStorage.getItem('appmixer-chat-sessions'));
    } catch (err) {}
    sessions = sessions || {};
    return sessions[location.origin + location.pathname];
}

function setSessionId(sessionId) {

    let sessions;
    try {
        sessions = JSON.parse(sessionStorage.getItem('appmixer-chat-sessions'));
    } catch (err) {}
    sessions = sessions || {};
    sessions[location.origin + location.pathname] = sessionId;
    sessionStorage.setItem('appmixer-chat-sessions', JSON.stringify(sessions));
}

function getToken() {

    // First, try to read the token from the URL.
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('chat_token');
    if (token) {
        return token;
    }

    // If not in the URL, try to read it from the session storage.
    return sessionStorage.getItem('appmixer-chat-token');
}

async function main() {

    sessionId = getSessionId();
    const token = getToken();
    if (token) {
        authHeader = {
            'x-appmixer-chat-token': token
        };
    }

    // Initialize session.
    const params = new URLSearchParams({ action: 'ensure-session', session_id: sessionId || '' });
    const response = await fetch(ENDPOINT + '?' + params, {
        method: 'POST',
        headers: {
            ...authHeader
        }
    });
    const session = await response.json();
    sessionId = session.id;
    setSessionId(sessionId);

    // Normalize for ChatBot UI widget.
    session.threads.forEach(thread => {
        thread.created = new Date(thread.createdAt);
        thread.agent = thread.agentId;
    });

    let activeChat = session.threads[session.threads.length - 1].id;

    chat = new ChatBot('#chat-container', {
        chats: session.threads,
        agents: session.agents,
        activeChat,
        withCache: false,
        format: 'markdown',
        render: 'bubbles',
        focus: true
    });
    chat.api.on('add-message', ({ id, message }) => addMessage(id, message));
    chat.api.on('request-messages', ({ id }) => loadMessages(id));
    chat.api.on('delete-chat', ({ id }) => deleteThread(id));

    pollForMessages();
}

async function pollForMessages() {
    while (true) {
        await loadMessages(chat.getConfig().activeChat);
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

async function loadMessages(threadId) {

    if (!threadId) return;

    try {
        const activeChat = chat.getConfig().activeChat;
        let lastMessageId = null;
        let threadMessages = chat.getConfig().messages || [];
        if (threadId === activeChat) {
            // Loading new messages to the active chat. Load only those that we are missing.
            const lastMessage = threadMessages[threadMessages.length - 1];
            if (lastMessage) {
                lastMessageId = lastMessage.id;
            }
        } else {
            // Switching threads, always set waiting to false.
            setWaiting(false);
        }

        const params = new URLSearchParams({ action: 'load-thread', thread_id: threadId });
        if (lastMessageId) {
            params.append('since_id', lastMessageId);
        }
        const response = await fetch(ENDPOINT + '?' + params, {
            method: 'GET',
            headers: {
                ...authHeader
            }
        });
        if (!response.ok && response.status === 404) {
            // Thread was removed in the mean time. No need to keep polling it.
            chat.removeChat(threadId);
            return;
        }

        const thread = await response.json();
        thread.messages = thread.messages || [];
        thread.messages.forEach(message => {
            if (message.role === 'agent') {
                message.author = thread.agentId;
            }
        });

        if (lastMessageId &&
            thread.messages.length &&
            thread.messages[thread.messages.length - 1].id !== lastMessageId) {
            setWaiting(false);
        }
        if (lastMessageId) {
            // Since we only loaded messages since lastMessageId, we need to merge with those
            // already in the chat.
            thread.messages = threadMessages.concat(thread.messages);
        }
        chat.parse(threadId, thread.messages);
    } catch (err) {
        console.error(err);
        // TODO: UI to show errors.
    }
}

function setWaiting(waiting) {

    if (waiting) {
        chat.container.classList.add('chat-waiting');
    } else {
        chat.container.classList.remove('chat-waiting');
    }
}

async function deleteThread(threadId) {

    const params = new URLSearchParams({ action: 'delete-thread', session_id: sessionId || '' });
    await fetch(ENDPOINT + '?' + params, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...authHeader
        },
        body: JSON.stringify({
            threadId
        })
    });
}

async function addMessage(threadId, message) {

    if (message.role !== 'user') return;

    setWaiting(true);

    if (!threadId) {
        const agentId = chat.getConfig().activeAgent;
        const theme = message.content.substring(0, 32);
        const params = new URLSearchParams({ action: 'add-thread' });
        const response = await fetch(ENDPOINT + '?' + params, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeader
            },
            body: JSON.stringify({
                sessionId,
                agentId,
                theme
            })
        });
        const thread = await response.json();
        threadId = thread.id;
        chat.addChat({
            convert: true,
            chat: {
                id: threadId,
                agent: agentId,
                theme,
                created: new Date(thread.createdAt)
            }
        });
    }

    // Send message to the server.
    const params = new URLSearchParams({ action: 'send-message', session_id: sessionId || '' });
    const response = await fetch(ENDPOINT + '?' + params, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...authHeader
        },
        body: JSON.stringify({
            threadId,
            id: message.id,
            content: message.content
        })
    });

    const serverMessage = await response.json();
    message.id = serverMessage.id;
}

main();
