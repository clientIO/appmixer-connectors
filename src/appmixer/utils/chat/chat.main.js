const { ChatBot } = chatbot;

let chat;

async function main() {

    const params = new URLSearchParams({ init: true });
    const response = await fetch(ENDPOINT + '?' + params);
    const { chats, agents } = await response.json();

    chats.forEach(chat => {
        chat.created = new Date(chat.created);
    });

    let activeChat = chats[0].id;
    
    chat = new ChatBot('#chat-container', {
        chats,
        agents,
        activeChat,
        withCache: true,
        ...OPTIONS
    });
    chat.api.on('add-message', ({ id, message }) => addMessage(id, message));
}

async function addMessage(chatId, message) {

    if (message.role !== 'user') return;
    
    if (!chatId) {
        chatId = new Date().getTime();
        chat.addChat({
            convert: true,
            chat: {
                id: chatId,
                agent: 1,
                theme: message.content.substring(0, 16),
                created: new Date(),
            },
        });
    }

    // Send chat ID, message to the server.
    const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ chatId, messageId: message.id, content: message.content }),
    });
    const data = await response.json();

    // https://docs.dhtmlx.com/chatbot/api/methods/addMessage/
    chat.addMessage({
        id: chatId,
        message: {
            role: 'agent',
            content: data.content,
            typing: 0
        },
    });
}

main();
