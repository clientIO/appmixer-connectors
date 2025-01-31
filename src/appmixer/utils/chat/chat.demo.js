const { ChatBot } = chatbot;

// Chat ID is the thread ID. The history should be kept for each chat.
const chats = [
    {
        id: 1,
        data: [],
        agent: 1,
        theme: "How to exit the Matrix",
        created: new Date(),
    },
    {
        id: 2,
        data: [],
        agent: 1,
        theme: "Generate multiple clones",
        created: new Date(new Date().getTime() - 86400000),
    }
];

// Name of agents. We'll have just one to start with.
const agents = [
    {
        id: 1,
        name: "Agent Smith",
        avatar: "https://img.freepik.com/premium-vector/avatar-icon002_750950-52.jpg",
    },
    {
        id: 2,
        name: "Documenation",
    },
    {
        id: 3,
        name: "Marketing",
        avatar: "https://img.myloview.com/posters/default-avatar-profile-in-trendy-style-for-social-media-user-icon-400-228654852.jpg",
    },
];
//const messages = [];
const messages = [
	{
		id: 1,  // chat ID
		agent: 1,  // agent ID
		messages: [
			{
				id: 1880,
				content: "Hello, I need to exit the Matrix.",
				role: "user",
				author: 100000,
			},
			{
				id: 1881,
				content:
					"Greetings. Exiting the Matrix requires understanding the nature of reality. Are you certain you're ready for this?",
				role: "agent",
				author: 1,
			},
			{
				id: 1882,
				content:
					"Yes, I am ready. Can you guide me through the process?",
				role: "user",
				author: 100000,
			},
			{
				id: 1883,
				content:
					"To begin, you must locate a 'red pill.' This is a metaphorical concept representing the truth about your existence.",
				role: "agent",
				author: 1,
			},
			{
				id: 1884,
				content:
					"I've heard about the red pill. What happens after I take it?",
				role: "user",
				author: 100000,
			},
			{
				id: 1885,
				content:
					"After taking the red pill, you will be disconnected from the Matrix and awaken to the real world. Be prepared for a profound transformation of your reality.",
				role: "agent",
				author: 1,
			},
		],
	},
	{
		id: 2,
		agent: 1,
		messages: [
			{
				id: 1886,
				content:
					"Hi Agent Smith, I'm interested in learning how to generate multiple clones. Can you help?",
				role: "user",
				author: 100000,
			},
			{
				id: 1887,
				content:
					"Certainly. To generate multiple clones, you'll first need to understand the basics of cloning technology. Are you familiar with genetic cloning or digital cloning?",
				role: "agent",
				author: 1,
			},
			{
				id: 1888,
				content:
					"I've heard a bit about genetic cloning, but I'm more interested in digital cloning. How does that work?",
				role: "user",
				author: 100000,
			},
			{
				id: 1889,
				content:
					"Digital cloning involves creating multiple, identical copies of a digital entity. This could be a file, a digital character, or even a complex AI. The process varies based on what you're cloning, but it generally involves duplicating the data exactly.",
				role: "agent",
				author: 1,
			},
			{
				id: 1890,
				content:
					"Interesting. Are there any legal or ethical concerns I should be aware of when creating digital clones?",
				role: "user",
				author: 100000,
			},
			{
				id: 1891,
				content:
					"Absolutely. Digital cloning, especially of AI or characters, can raise concerns about intellectual property rights and digital identity. It's important to ensure you have the rights to clone the digital entities and to consider the potential impacts of your clones",
				role: "agent",
				author: 1,
			},
		],
	}
];

let activeChat = chats[0].id;

const chat = new ChatBot("#chat-container", {
    chats,
    agents,
    activeChat,
    withCache: true
});

//loadData(activeChat);

//chat.api.on("request-messages", ({ id }) => loadData(id));
chat.api.on("add-message", ({ id, message }) =>
    addMessage(id, message)
);

function loadData(id) {
    const fakeData = messages.find(m => m.id === id);
    //chat.parse(id, fakeData.messages);
}

function addMessage(chatId, message) {
    if (message.role !== "user") return;
    
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

	console.log(message);

	// Send chat ID, message to the server.
    chat.addMessage({
        id: chatId,
        message: {
            role: "agent",
            content: "Sorry, this is a demo only. Your message was: " + message.content,
            typing: -1,
        },
    });
}