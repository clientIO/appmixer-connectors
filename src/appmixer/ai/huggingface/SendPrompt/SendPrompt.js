'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const {
            model,
            prompt,
            systemPrompt,
            messages,
            maxTokens,
            temperature,
            topP
        } = context.messages.in.content;

        if (!model) {
            throw new context.CancelError('Model is required!');
        }

        // Either a single prompt or a full messages array is accepted. The array
        // wins when both are set, because it carries the richer conversation.
        const parsedMessages = lib.parseJson(context, messages, 'Messages');
        let chatMessages;

        if (parsedMessages) {
            if (!Array.isArray(parsedMessages)) {
                throw new context.CancelError('Messages must be a JSON array of chat messages.');
            }
            chatMessages = parsedMessages;
        } else {
            if (!prompt) {
                throw new context.CancelError('Prompt is required!');
            }
            chatMessages = [{ role: 'user', content: prompt }];
        }

        if (systemPrompt && !chatMessages.some(message => message && message.role === 'system')) {
            chatMessages = [{ role: 'system', content: systemPrompt }, ...chatMessages];
        }

        const data = {
            model,
            messages: chatMessages
        };

        if (maxTokens) {
            data.max_tokens = Number(maxTokens);
        }
        if (temperature !== undefined && temperature !== null && temperature !== '') {
            data.temperature = Number(temperature);
        }
        if (topP !== undefined && topP !== null && topP !== '') {
            data.top_p = Number(topP);
        }

        const response = await lib.makeRequest({
            context,
            method: 'POST',
            baseUrl: lib.ROUTER_BASE_URL,
            path: '/v1/chat/completions',
            data
        });

        const choice = (response && response.choices && response.choices[0]) || {};
        const usage = (response && response.usage) || {};

        return context.sendJson({
            id: response && response.id,
            model: response && response.model,
            answer: (choice.message && choice.message.content) || '',
            finishReason: choice.finish_reason || null,
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0
        }, 'out');
    }
};
