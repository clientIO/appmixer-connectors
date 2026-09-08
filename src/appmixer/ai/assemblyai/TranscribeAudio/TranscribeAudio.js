'use strict';

const lib = require('../lib');

// Maps camelCase component inputs to the snake_case boolean fields the API expects.
const BOOLEAN_FIELDS = {
    languageDetection: 'language_detection',
    speakerLabels: 'speaker_labels',
    multichannel: 'multichannel',
    punctuate: 'punctuate',
    formatText: 'format_text',
    filterProfanity: 'filter_profanity',
    contentSafety: 'content_safety',
    iabCategories: 'iab_categories',
    entityDetection: 'entity_detection',
    sentimentAnalysis: 'sentiment_analysis',
    autoHighlights: 'auto_highlights',
    redactPii: 'redact_pii',
    redactPiiAudio: 'redact_pii_audio'
};

module.exports = {

    async receive(context) {

        const input = context.messages.in.content;

        if (!input.audioUrl) {
            throw new context.CancelError('Audio URL is required!');
        }

        const body = { audio_url: input.audioUrl };

        if (input.speechModel) {
            body.speech_model = input.speechModel;
        }
        if (input.languageCode) {
            body.language_code = input.languageCode;
        }
        if (input.speakersExpected !== undefined && input.speakersExpected !== null && input.speakersExpected !== '') {
            body.speakers_expected = input.speakersExpected;
        }
        if (input.webhookUrl) {
            body.webhook_url = input.webhookUrl;
        }

        // Send the explicit value whenever the toggle was set: some options (punctuate,
        // format_text) default to true at AssemblyAI, so omitting false would silently
        // ignore a user turning them off.
        Object.keys(BOOLEAN_FIELDS).forEach(inputName => {
            const value = input[inputName];
            if (value === undefined || value === null || value === '') {
                return;
            }
            body[BOOLEAN_FIELDS[inputName]] = value === true || value === 'true';
        });

        const { data } = await context.httpRequest({
            method: 'POST',
            url: `${lib.getBaseUrl(context)}/v2/transcript`,
            headers: {
                ...lib.getHeaders(context),
                'Content-Type': 'application/json'
            },
            data: body
        });

        return context.sendJson({
            id: data.id,
            status: data.status,
            audio_url: data.audio_url
        }, 'out');
    }
};
