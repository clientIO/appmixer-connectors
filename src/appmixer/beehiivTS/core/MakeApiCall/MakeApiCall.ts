import type { AppmixerContext } from '../../types';

interface MakeApiCallInput {
    url: string;
    method: string;
    headers?: string;
    parameters?: string;
    body?: string;
}

module.exports = {
    async receive(context: AppmixerContext): Promise<void> {
        const { url, method, headers, parameters, body } =
            context.messages.in.content as MakeApiCallInput;

        if (!url) {
            throw new context.CancelError('API Endpoint URL is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        let parsedHeaders: Record<string, string> = {};
        if (headers) {
            try {
                parsedHeaders = JSON.parse(headers);
            } catch (e) {
                throw new context.CancelError('Headers must be a valid JSON object.');
            }
        }

        let parsedParameters: Record<string, string> = {};
        if (parameters) {
            try {
                parsedParameters = JSON.parse(parameters);
            } catch (e) {
                throw new context.CancelError('Parameters must be a valid JSON object.');
            }
        }

        const baseUrl = 'https://api.beehiiv.com/v2';
        const targetUrl = url.startsWith('http://') || url.startsWith('https://')
            ? url
            : `${baseUrl}${url}`;

        const queryString = Object.keys(parsedParameters).length
            ? '?' + new URLSearchParams(parsedParameters).toString()
            : '';

        const requestOptions: {
            method: string;
            url: string;
            headers: Record<string, string>;
            data?: unknown;
        } = {
            method,
            url: targetUrl + queryString,
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/json',
                ...parsedHeaders
            }
        };

        if (body) {
            try {
                requestOptions.data = JSON.parse(body);
            } catch (e) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
        }

        const response = await context.httpRequest(requestOptions);

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
