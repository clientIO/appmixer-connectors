'use strict';

module.exports = {

    receive: async function(context) {

        const { 
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

        const searchDomainArray = searchDomains.split(',').map(domain => domain.trim());
        const ignoreDomainArray = ignoreDomains.split(',').map(domain => `-${domain.trim()}`);
        const searchDomainFilter = [...searchDomainArray, ...ignoreDomainArray];

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
                frequency_penalty: frequencyPenalty,
                max_tokens: maxTokens,
                presence_penalty: presencePenalty,
                search_domain_filter: searchDomainFilter,
                temperature: temperature,
                top_k: topK,
                top_p: topP
            }
        };
        await context.log({ step: 'Making request', req });
        const { data } = await context.httpRequest(req);

        return context.sendJson(data, 'out');
    }
};