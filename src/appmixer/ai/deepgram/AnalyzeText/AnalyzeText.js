'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const {
            text, url, language, summarize, sentiment, topics, intents, customTopic, customIntent
        } = context.messages.in.content;

        if (!text && !url) {
            throw new context.CancelError('Provide either Text or a URL to analyze.');
        }

        if (!summarize && !sentiment && !topics && !intents) {
            throw new context.CancelError('Enable at least one analysis feature (Summarize, Sentiment, Topics or Intents).');
        }

        const params = lib.cleanParams({
            language: language || 'en',
            summarize: summarize ? 'true' : undefined,
            sentiment: sentiment ? 'true' : undefined,
            topics: topics ? 'true' : undefined,
            intents: intents ? 'true' : undefined,
            custom_topic: customTopic,
            custom_intent: customIntent
        });

        const response = await lib.apiRequest(context, {
            method: 'POST',
            path: '/v1/read',
            params,
            headers: { 'Content-Type': 'application/json' },
            data: text ? { text } : { url }
        });

        const result = response.data || {};

        return context.sendJson({
            metadata: result.metadata || {},
            results: result.results || {}
        }, 'out');
    }
};
