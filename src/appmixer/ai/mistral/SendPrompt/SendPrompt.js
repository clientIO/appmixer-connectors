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

        // The same flat shape as the other AI connectors' Send Prompt: the answer is
        // a top-level field rather than an item of the API's `choices` array.
        const choice = response?.choices?.[0] || {};
        const outputData = {
            answer: assistantReply,
            prompt,
            id: response?.id,
            model: response?.model,
            created: response?.created,
            finishReason: choice.finish_reason,
            usage: {
                prompt_tokens: response?.usage?.prompt_tokens,
                completion_tokens: response?.usage?.completion_tokens,
                total_tokens: response?.usage?.total_tokens
            }
        };

        return context.sendJson(outputData, 'out');
    }
};
