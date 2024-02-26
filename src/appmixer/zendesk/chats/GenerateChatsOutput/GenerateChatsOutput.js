'use strict';

/**
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { sendWholeArray = false } = context.properties;
        return context.sendJson({ sendWholeArray }, 'out');
    },

    getOutputOptions({ sendWholeArray }) {
        if (sendWholeArray) {
            return [{ label: 'Chats', value: 'chats' }];
        } else {
            return [
                { label: 'ID', value: 'id' },
                { label: 'Visitor\'s Information', value: 'visitor' },
                { label: 'Visitor\'s ID', value: 'visitor.id' },
                { label: 'Visitor\'s Name', value: 'visitor.name' },
                { label: 'Visitor\'s Email', value: 'visitor.email' },
                { label: 'Visitor\'s Phone No', value: 'visitor.phone' },
                { label: 'Visitor\'s Notes', value: 'visitor.notes' },
                { label: 'Chat Type', value: 'type' },
                { label: 'Started By', value: 'started_by' },
                { label: 'Session', value: 'session' },
                { label: 'Timestamp', value: 'timestamp' },
                { label: 'Count', value: 'count' },
                { label: 'Duration', value: 'duration' },
                { label: 'Department ID', value: 'department_id' },
                { label: 'Department Name', value: 'department_name' },
                { label: 'Response Time', value: 'response_time' },
                { label: 'Agent Names', value: 'agent_names' },
                { label: 'Agent IDs', value: 'agent_ids' },
                { label: 'Triggered', value: 'triggered' },
                { label: 'Triggered Response', value: 'triggered_response' },
                { label: 'Unread', value: 'unread' },
                { label: 'Missed', value: 'missed' },
                { label: 'History', value: 'history' },
                { label: 'Conversions', value: 'conversions' },
                { label: 'Tags', value: 'tags' },
                { label: 'Rating', value: 'rating' },
                { label: 'Comment', value: 'comment' },
                { label: 'Message', value: 'message' },
                { label: 'Webpath', value: 'webpath' },
                { label: 'Zendesk Ticket ID', value: 'zendesk_ticket_id' }
            ];
        }
    }
};
