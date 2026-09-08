'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const {
            conversationId,
            instructions,
            prompt,
            model,
            temperature,
            maxTokens,
            topP,
            randomSeed,
            safePrompt
        } = context.messages.in.content;

        // Validate required inputs
        if (!model) {
            throw new context.CancelError('Model is required!');
        }
        if (!prompt) {
            throw new context.CancelError('Prompt is required!');
        }

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

        const data = {
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            top_p: topP,
            random_seed: randomSeed,
            safe_prompt: safePrompt
        };

        // Remove undefined optional parameters.
        Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

        // https://docs.mistral.ai/api/#tag/chat
        const { data: response } = await context.httpRequest({
            method: 'POST',
            url: `${lib.getBaseUrl()}/chat/completions`,
            headers: lib.requestHeaders(context, { 'content-type': 'application/json' }),
            data
        });

        const assistantReply = response?.choices?.[0]?.message?.content || '';

        // Update conversation state
        if (conversationId) {
            const newMessages = [
                { role: 'user', content: prompt },
                { role: 'assistant', content: assistantReply }
            ];
            let totalTokens = newMessages.reduce((sum, msg) => sum + msg.content.split(' ').length, 0);
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

        // Collapse the choices array to its first element so downstream fields
        // such as choices.message.content resolve directly.
        const outputData = {
            ...response,
            choices: response.choices?.[0]
        };

        return context.sendJson(outputData, 'out');
    }
};
