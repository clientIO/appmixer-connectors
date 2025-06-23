'use strict';

module.exports = {
    receive: async function(context) {
        const {
            conversationId,
            instructions,
            prompt,
            model,
            frequencyPenalty,
            maxCompletionTokens,
            presencePenalty,
            temperature,
            topP
        } = context.messages.in.content;

        let messages = [];

        // Include instructions if provided
        if (instructions) {
            messages.push({ role: 'system', content: instructions });
        }

        // Load previous conversation history
        let stateMessages = [];
        if (conversationId) {
            stateMessages = await context.flow.stateGet(conversationId);
            if (stateMessages?.messages) {
                messages = messages.concat(stateMessages.messages);
            }
        }

        // Add current user prompt
        messages.push({ role: 'user', content: prompt });

        // Prepare request to Groq
        const req = {
            method: 'POST',
            url: 'https://api.groq.com/openai/v1/chat/completions',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                Authorization: `Bearer ${context.auth.apiKey}`
            },
            data: {
                model,
                messages,
                frequency_penalty: frequencyPenalty,
                presence_penalty: presencePenalty,
                temperature: temperature,
                top_p: topP,
                ...(maxCompletionTokens !== undefined ? { max_completion_tokens: maxCompletionTokens } : {})
            }
        };

        await context.log({ step: 'Making request', req });

        const { data } = await context.httpRequest(req);
        const assistantReply = data?.choices?.[0]?.message?.content || '[No reply generated]';

        const newMessages = [
            { role: 'user', content: prompt },
            { role: 'assistant', content: assistantReply }
        ];

        // Count tokens for new messages
        const newTokens = newMessages.reduce((sum, msg) => sum + msg.content.split(' ').length, 0);

        // Update conversation state
        if (conversationId) {
            let totalTokens = newTokens;
            const existingMessages = stateMessages?.messages || [];

            totalTokens += existingMessages.reduce((sum, msg) => sum + msg.content.split(' ').length, 0);

            // Trim if token limit exceeded (4k tokens)
            while (totalTokens > 4000 && existingMessages.length > 0) {
                const removed = existingMessages.shift();
                totalTokens -= removed.content.split(' ').length;
            }

            const updatedMessages = existingMessages.concat(newMessages);
            await context.flow.stateSet(conversationId, { messages: updatedMessages });
        }

        // Format output for connector
        const outputData = {
            ...data,
            choices: data.choices?.[0]
        };

        await context.log({ step: 'Response', outputData });
        return context.sendJson(outputData, 'out');
    }
};
