'use strict';

const lib = require('../../lib');

module.exports = {
    async receive(context) {

        const { transcriptId } = context.messages.in.content;

        if (!transcriptId) {
            throw new context.CancelError('Transcript ID is required!');
        }

        const query = `
            query Transcript($id: String!) {
                transcript(id: $id) {
                    id
                    title
                    host_email
                    organizer_email
                    transcript_url
                    meeting_link
                    duration
                    dateString
                    date
                    audio_url
                    video_url
                    participants
                    speakers {
                        id
                        name
                    }
                    summary {
                        keywords
                        action_items
                        outline
                        overview
                        short_summary
                        bullet_gist
                        gist
                    }
                    sentences {
                        index
                        speaker_name
                        speaker_id
                        text
                        start_time
                        end_time
                    }
                }
            }
        `;

        const data = await lib.makeRequest({ context, query, variables: { id: transcriptId } });

        if (!data || !data.transcript) {
            throw new context.CancelError(`Transcript ${transcriptId} not found.`);
        }

        return context.sendJson(data.transcript, 'out');
    }
};
