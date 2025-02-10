const { ChatBot } = chatbot;

const threads = [
	{
		"id": "3c444aaa-8258-4a92-b779-e9a8a2cbef1d",
		"agentId": "65019b40-4644-41fd-83d2-00339f5a5672",
		"createdAt": "2025-02-10T17:08:18.565Z",
		"sessionId": "ef1cf7b4-8bed-4765-9f72-492cfe2d3019",
		"theme": "Ask David"
	},
	{
		"id": "beac1fcb-918d-4cf2-95ab-3cf6716f8bf8",
		"agentId": "65019b40-4644-41fd-83d2-00339f5a5672",
		"createdAt": "2025-02-10T17:09:25.810Z",
		"sessionId": "ef1cf7b4-8bed-4765-9f72-492cfe2d3019",
		"theme": "Who's the best c"
	}
];

const agents = [
	{
		"name": "Agent David",
		"avatar": "https://img.freepik.com/premium-vector/avatar-icon002_750950-52.jpg",
		"message": "Hello! How can I help you?",
		"componentId": "47a8691a-dbf9-4c4b-a0fd-dffcd66f519e",
		"flowId": "1037c66b-c2a8-489c-aa3e-efe548a38a3e",
		"id": "65019b40-4644-41fd-83d2-00339f5a5672",
		"userId": "583c06511afb7b0016ef120b",
		"createdAt": "2025-02-10T16:21:29.089Z"
	}
];

const messages = [
    {
        "id": "temp://1739207314826",
        "componentId": "47a8691a-dbf9-4c4b-a0fd-dffcd66f519e",
        "content": "Who's the best czech football player?",
        "createdAt": "2025-02-10T17:09:26.218Z",
        "flowId": "1037c66b-c2a8-489c-aa3e-efe548a38a3e",
        "role": "user",
        "threadId": "beac1fcb-918d-4cf2-95ab-3cf6716f8bf8",
        "userId": "583c06511afb7b0016ef120b"
    },
    {
        "id": "ead0caac-d2e4-4460-bf61-c74a2e35e45e",
        "componentId": "5961dadf-27f5-46e4-a680-eee55b4e006a",
        "content": "Determining the \"best\" Czech football player can be subjective and depends on the criteria used, such as skill, achievements, or influence. However, several Czech footballers are often mentioned among the greatest:\n\n1. **Pavel Nedvěd**: Often considered one of the greatest Czech footballers, Nedvěd won the Ballon d'Or in 2003. He had an illustrious career with clubs like Lazio and Juventus and was known for his skill, stamina, and leadership on the field.\n\n2. **Josef Masopust**: He was one of the most celebrated Czech footballers of the 20th century. Masopust won the Ballon d'Or in 1962 and was a key player in the Czechoslovakia national team's run to the 1962 FIFA World Cup final.\n\n3. **Petr Čech**: As a goalkeeper, Čech is recognized for his successful career, particularly with Chelsea in the English Premier League, where he won multiple league titles and the UEFA Champions League. He also earned over 100 caps for the Czech national team.\n\n4. **Tomáš Rosický**: Known for his creativity and playmaking abilities, Rosický had a fine career with Borussia Dortmund and Arsenal. He was a pivotal part of the Czech national team for many years.\n\nThese players have left significant marks on Czech and international football, and each could be considered the \"best\" depending on your criteria.",
        "createdAt": "2025-02-10T17:09:41.453Z",
        "flowId": "1037c66b-c2a8-489c-aa3e-efe548a38a3e",
        "role": "agent",
        "threadId": "beac1fcb-918d-4cf2-95ab-3cf6716f8bf8",
        "userId": "583c06511afb7b0016ef120b",
		"author": "65019b40-4644-41fd-83d2-00339f5a5672"
    },
    {
        "id": "temp://1739208274222",
        "componentId": "47a8691a-dbf9-4c4b-a0fd-dffcd66f519e",
        "content": "Who's better, Nedved or Masopust?",
        "createdAt": "2025-02-10T17:24:50.268Z",
        "flowId": "1037c66b-c2a8-489c-aa3e-efe548a38a3e",
        "role": "user",
        "threadId": "beac1fcb-918d-4cf2-95ab-3cf6716f8bf8",
        "userId": "583c06511afb7b0016ef120b"
    },
    {
        "id": "4dbb6b1e-fe44-4b00-b800-0e7dba82cf53",
        "componentId": "5961dadf-27f5-46e4-a680-eee55b4e006a",
        "content": "Comparing Pavel Nedvěd and Josef Masopust can be challenging because they played in different eras and positions, but here is a broad overview of their careers and skills to help highlight their differences and strengths:\n\n### Pavel Nedvěd\n\n- **Era**: Primarily 1990s to 2000s.\n- **Position**: Primarily a midfielder, known for playing on the left wing or in central positions.\n- **Playing Style**: Known for his incredible stamina, work rate, and tactical intelligence. He was also recognized for his powerful shooting ability and versatility on the field.\n- **Clubs**: Had notable spells at Lazio and Juventus, with whom he achieved significant success, including several Serie A titles and a UEFA Champions League final appearance.\n- **Achievements**: Won the Ballon d'Or in 2003.\n- **International Career**: He was a key player for the Czech Republic, leading them to the Euro 2004 semifinals.\n\n### Josef Masopust\n\n- **Era**: Primarily 1950s to 1960s.\n- **Position**: Central midfielder, often playing as a playmaker.\n- **Playing Style**: Known for his elegance, vision, and technical ability on the ball. He had remarkable dribbling skills and could orchestrate the game from the midfield.\n- **Clubs**: Most famously played for Dukla Prague.\n- **Achievements**: Won the Ballon d'Or in 1962.\n- **International Career**: Led Czechoslovakia to the 1962 FIFA World Cup final, where he scored in the final against Brazil.\n\n### Conclusion\n\n- **Era and Style**: Masopust's style was more typically what you might expect from a classic central midfielder or playmaker, whereas Nedvěd was known for his dynamic and all-action style as more of an attacking midfielder or winger.\n- **Achievements**: Both won the Ballon d'Or, which indicates their high level of skill and impact on football during their respective times.\n\nUltimately, the judgment of who is \"better\" could depend on personal preference, the specific attributes or style of play you value more, and the context of the eras in which they played. Nedvěd's impact on modern European club football might resonate more with contemporary fans, while Masopust's influence and achievements during the 1960s holds a strong historical significance.",
        "createdAt": "2025-02-10T17:25:07.677Z",
        "flowId": "1037c66b-c2a8-489c-aa3e-efe548a38a3e",
        "role": "agent",
        "threadId": "beac1fcb-918d-4cf2-95ab-3cf6716f8bf8",
        "userId": "583c06511afb7b0016ef120b"
    }
];

 // Normalize for ChatBot UI widget.
threads.forEach(thread => {
	thread.created = new Date(thread.createdAt);
	thread.agent = thread.agentId;
});

let activeChat = threads[0].id;

const chat = new ChatBot("#chat-container", {
    chats: threads,
    agents,
    activeChat,
	//messages: messages[0].messages,
    withCache: false,
	format: 'markdown',
	render: 'bubbles',
	sidebar: true
});

loadData(activeChat);
//loadData(activeChat);

chat.api.on("request-messages", ({ id }) => loadData(id));
chat.api.on("add-message", ({ id, message }) =>
    addMessage(id, message)
);

function setWaiting(waiting) {
	const el = document.querySelector('#chat-waiting');
	if (waiting) {
		el.classList.remove('off');
	} else {
		el.classList.add('off');
	}
}

function loadData(chatId) {
    const fakeData = messages.filter(m => m.threadId === chatId);
    chat.parse(chatId, fakeData || []);
	setWaiting(false);
}

function addMessage(chatId, message) {
	
    if (message.role !== "user") return;
	setWaiting(true);
    
    if (!chatId) {
		debugger;
		// User clicked on "new chat" button.
        chatId = new Date().getTime();
        chat.addChat({
            convert: true,
            chat: {
                id: chatId,
                agent: chat.getConfig().activeAgent,
                theme: message.content.substring(0, 16),
                created: new Date(),
            }
        });
    }

	console.log(message);

	// Send chat ID, message to the server.
    chat.addMessage({
        id: chatId,
        message: {
            role: "agent",
            content: "Sorry, this is a demo only. Your message was: " + message.content,
            typing: 0,
        },
    });
}