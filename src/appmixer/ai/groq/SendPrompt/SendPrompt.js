'use strict';

const lib = require('../lib');

// Rough word-count stand-in for real token accounting; only used to decide when
// to trim the stored conversation history.
const APPROX_TOKEN_LIMIT = 4000;
const countTokens = messages => messages.reduce((sum, msg) => sum + msg.content.split(' ').length, 0);

module.exports = {

    async receive(context) {

        const {
            prompt,
            instructions,
            model,
            conversationId,
            frequencyPenalty,
            maxCompletionTokens,
            presencePenalty,
            temperature,
            topP
        } = context.messages.in.content;

        if (!prompt) {
            throw new context.CancelError('Prompt is required!');
        }
        if (!model) {
            throw new context.CancelError('Model is required!');
        }

        let messages = [];

        // Include instructions if provided
        if (instructions) {
            messages.push({ role: 'system', content: instructions });
        }

        // Load previous conversation history
        let stateMessages = null;
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
            frequency_penalty: frequencyPenalty,
            presence_penalty: presencePenalty,
            temperature,
            top_p: topP,
            max_completion_tokens: maxCompletionTokens
        };

        // Remove undefined optional parameters.
        Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

        await context.log({ step: 'Making request', model, messageCount: messages.length });

        // https://console.groq.com/docs/api-reference#chat-create
        const { data: response } = await lib.request({
            context,
            method: 'POST',
            path: '/chat/completions',
            data
        });

        const choice = response.choices?.[0];
        const answer = choice?.message?.content || '[No reply generated]';

        const newMessages = [
            { role: 'user', content: prompt },
            { role: 'assistant', content: answer }
        ];

        // Update conversation state
        if (conversationId) {
            const existingMessages = stateMessages?.messages || [];
            let totalTokens = countTokens(newMessages) + countTokens(existingMessages);

            // Trim the oldest turns once the approximate limit is exceeded.
            while (totalTokens > APPROX_TOKEN_LIMIT && existingMessages.length > 0) {
                const removed = existingMessages.shift();
                totalTokens -= removed.content.split(' ').length;
            }

            await context.flow.stateSet(conversationId, { messages: existingMessages.concat(newMessages) });
        }

        return context.sendJson({
            answer,
            prompt,
            id: response.id,
            model: response.model,
            created: response.created,
            finishReason: choice?.finish_reason,
            usage: response.usage
        }, 'out');
    }
};
