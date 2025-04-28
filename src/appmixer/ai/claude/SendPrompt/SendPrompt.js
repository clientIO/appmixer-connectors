/* eslint-disable camelcase */

module.exports = {
    async receive(context) {

        const { prompt, system, model, max_tokens } = context.messages.in.content;

        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.anthropic.com/v1/messages',
            headers: {
                'x-api-key': context.auth.apiKey,
                'anthropic-version': '2023-06-01'
            },
            data: {
                system: system || 'You are a helpful assistant.',
                messages: [{ role: 'user', content: prompt }],
                max_tokens,
                model
            }
        });

        let answer = data?.content[0].text ?? '';

        return context.sendJson({ answer, prompt }, 'out');
    }
};
