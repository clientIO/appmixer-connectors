'use strict';

const lib = require('../../lib');

module.exports = {
    async receive(context) {

        const {
            query,
            answerDepth,
            searchDepth,
            topic,
            maxResults,
            includeDomains,
            excludeDomains
        } = context.messages.in.content;

        if (!query) {
            throw new context.CancelError('Question is required!');
        }

        const data = {
            query,
            include_answer: answerDepth || 'basic',
            search_depth: searchDepth || 'basic',
            topic: topic || 'general'
        };

        if (maxResults) {
            data.max_results = maxResults;
        }

        const include = lib.toList(includeDomains);
        if (include) {
            data.include_domains = include;
        }
        const exclude = lib.toList(excludeDomains);
        if (exclude) {
            data.exclude_domains = exclude;
        }

        const response = await lib.makeRequest({ context, path: '/search', data });

        // Tavily always returns an `answer` when include_answer is set, but a query
        // that matches nothing can yield an empty string. Surface that as a cancel
        // rather than silently emitting a blank answer downstream.
        if (!response || !response.answer) {
            throw new context.CancelError(`Tavily could not generate an answer for: ${query}`);
        }

        const sources = (response.results || []).map(result => ({
            title: result.title,
            url: result.url,
            content: result.content,
            score: result.score
        }));

        return context.sendJson({
            query: response.query || query,
            answer: response.answer,
            sources,
            response_time: response.response_time,
            request_id: response.request_id
        }, 'out');
    }
};
