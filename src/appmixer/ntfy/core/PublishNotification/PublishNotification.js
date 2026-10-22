'use strict';

module.exports = {

    async receive(context) {

        if (!context.messages.in.content.topic) {
            throw new context.CancelError('Topic is required!');
        }
        if (!context.messages.in.content.message) {
            throw new context.CancelError('Message is required!');
        }

        const {
            topic,
            message,
            title,
            priority,
            tags,
            clickUrl,
            iconUrl,
            attachUrl,
            markdown,
            delay,
            email
        } = context.messages.in.content;

        const serverUrl = (context.auth.serverUrl || 'https://ntfy.sh').replace(/\/$/, '');

        // Build request headers.
        const headers = {
            'Content-Type': 'text/plain; charset=utf-8'
        };

        if (context.auth.accessToken) {
            headers['Authorization'] = `Bearer ${context.auth.accessToken}`;
        }

        if (title) {
            headers['Title'] = title;
        }

        if (priority && priority !== 'default') {
            headers['Priority'] = priority;
        }

        if (tags) {
            // Accept either comma-separated string or an array.
            const tagList = Array.isArray(tags)
                ? tags.join(',')
                : tags;
            headers['Tags'] = tagList;
        }

        if (clickUrl) {
            headers['Click'] = clickUrl;
        }

        if (iconUrl) {
            headers['Icon'] = iconUrl;
        }

        if (attachUrl) {
            headers['Attach'] = attachUrl;
        }

        if (markdown) {
            headers['Markdown'] = 'yes';
        }

        if (delay) {
            headers['Delay'] = delay;
        }

        if (email) {
            headers['Email'] = email;
        }

        let response;
        try {
            response = await context.httpRequest({
                method: 'POST',
                url: `${serverUrl}/${encodeURIComponent(topic)}`,
                headers,
                data: message
            });
        } catch (err) {
            throw new Error(`Failed to publish ntfy notification: ${err.message}`);
        }

        if (response.data && (response.data.code === 'unauthorized' || response.data.code === 'forbidden')) {
            throw new Error('Authentication failed. Check your access token and topic permissions.');
        }

        if (!response.data || !response.data.id) {
            const body = typeof response.data === 'string'
                ? response.data
                : JSON.stringify(response.data);
            throw new Error(`ntfy API returned an unexpected response: ${body}`);
        }

        // ntfy responds with a JSON object describing the published message.
        const result = typeof response.data === 'string'
            ? JSON.parse(response.data)
            : response.data;

        return context.sendJson(result, 'out');
    }
};
