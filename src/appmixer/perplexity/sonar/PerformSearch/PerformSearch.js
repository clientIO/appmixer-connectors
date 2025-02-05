'use strict';

module.exports = {

    receive: async function(context) {

        const {
            conversationId,
            instructions,
            prompt,
            model,
            frequencyPenalty,
            maxTokens,
            presencePenalty,
            searchDomains,
            ignoreDomains,
            temperature,
            topK,
            topP
        } = context.messages.in.content;

        const searchDomainArray = searchDomains ? searchDomains.split(',').map(domain => domain.trim()) : [];
        const ignoreDomainArray = ignoreDomains ? ignoreDomains.split(',').map(domain => `-${domain.trim()}`) : [];
        const searchDomainFilter = [...searchDomainArray, ...ignoreDomainArray];

        let messages = [];
        let stateMessages = [];

        // Add instructions to messages if provided
        if (instructions) {
            messages.push({ role: 'system', content: instructions });
        }

        // Retrieve state messages if conversationId is provided
        if (conversationId) {
            stateMessages = await context.flow.stateGet(conversationId);
            if (stateMessages && stateMessages.messages) {
                messages = messages.concat(stateMessages.messages);
            }
        }

        // Add the current user prompt to messages
        messages.push({ role: 'user', content: prompt });

        const req = {
            method: 'POST',
            url: 'https://api.perplexity.ai/chat/completions',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                Authorization: `Bearer ${context.auth.apiKey}`
            },
            data: {
                model: model,
                messages: messages,
                frequency_penalty: frequencyPenalty,
                max_tokens: maxTokens,
                presence_penalty: presencePenalty,
                temperature: temperature,
                top_k: topK,
                top_p: topP
            }
        };

        if (searchDomainFilter.length > 0) {
            req.data.search_domain_filter = searchDomainFilter;
        }

        await context.log({ step: 'Making request', req });
        const { data } = await context.httpRequest(req);

        const newMessages = [
            { role: 'user', content: prompt },
            { role: 'assistant', content: data.choices[0].message.content }
        ];

        // Calculate the total tokens in the new messages
        const newTokens = newMessages.reduce((acc, msg) => acc + msg.content.split(' ').length, 0);

        if (conversationId) {
            if (!stateMessages || !stateMessages.messages) { // First run, no previous messages
                await context.flow.stateSet(conversationId, { messages: newMessages });
            } else { // Subsequent runs, add to existing messages
                let totalTokens = newTokens;
                totalTokens += stateMessages.messages.reduce((acc, msg) => acc + msg.content.split(' ').length, 0);

                // Remove older messages if total tokens exceed 4000
                while (totalTokens > 4000 && stateMessages.messages.length > 0) {
                    const removedMessage = stateMessages.messages.shift();
                    totalTokens -= removedMessage.content.split(' ').length;
                }
                const updatedMessages = stateMessages.messages.concat(newMessages);
                await context.flow.stateSet(conversationId, { messages: updatedMessages });
            }
        }

        // Convert choices array to an object
        const outputData = {
            ...data,
            choices: data.choices[0]
        };
        context.log({ step: 'Response', outputData });
        return context.sendJson(outputData, 'out');
    }
};
