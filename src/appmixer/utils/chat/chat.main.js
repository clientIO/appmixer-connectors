const { ChatBot } = chatbot;

let chat;
let sessionId;

async function main() {

    // Session ID associates chats and agents with the user.
    sessionId = sessionStorage.getItem('appmixer-chat-session-id');

    // Initialize session.
    let session;
    if (sessionId) {
        const params = new URLSearchParams({ action: 'load-session', sessionId });
        const response = await fetch(ENDPOINT + '?' + params);
        session = await response.json();
    } else {
        const params = new URLSearchParams({ action: 'create-session' });
        const response = await fetch(ENDPOINT + '?' + params);
        session = await response.json();
        sessionId = session.id;
        sessionStorage.setItem('appmixer-chat-session-id', sessionId);
    }

    // Normalize for ChatBot UI widget.
    session.threads.forEach(thread => {
        thread.created = new Date(thread.createdAt);
        thread.agent = thread.agentId;
    });

    let activeChat = session.threads[0].id;
    
    chat = new ChatBot('#chat-container', {
        chats: session.threads,
        agents: session.agents,
        activeChat,
        withCache: false,
        format: 'markdown',
        render: 'bubbles'
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
        const params = new URLSearchParams({ action: 'load-thread', threadId });
        const response = await fetch(ENDPOINT + '?' + params);
        const thread = await response.json();
        thread.messages = thread.messages || [];
        thread.messages.forEach(message => {
            if (message.role === 'agent') {
                message.author = thread.agentId;
            }
        });
        if (thread.messages.length) {
            setWaiting(false);
        }
        chat.parse(threadId, thread.messages);
    } catch (err) {
        console.error(err);
        // TODO: UI to show errors.
    }
}

function setWaiting(waiting) {

    if (waiting) {
        document.getElementById('chat-waiting').style.display = 'block';
    } else {
        document.getElementById('chat-waiting').style.display = 'none';
    }
}

async function deleteThread(threadId) {

    const params = new URLSearchParams({ action: 'delete-thread', sessionId });
    const response = await fetch(ENDPOINT + '?' + params, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
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
        const theme = message.content.substring(0, 16);
        const params = new URLSearchParams({ action: 'add-thread' });
        const response = await fetch(ENDPOINT + '?' + params, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
            },
        });
    }

    // Send message to the server.
    const params = new URLSearchParams({ action: 'send-message', sessionId });
    const response = await fetch(ENDPOINT + '?' + params, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            threadId,
            id: message.id,
            content: message.content
        }),
    });
}

main();
