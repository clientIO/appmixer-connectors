'use strict';

const lib = require('../../lib');

// Drives both the emitted records and the dynamic output port options, so every leaf needs
// a type, a human title and a realistic example - those become the variable picker entries.
const schema = {
    status: { type: 'string', title: 'Status', example: 'administrator' },
    user: {
        type: 'object',
        title: 'User',
        properties: {
            id: { type: 'integer', title: 'User ID' },
            is_bot: { type: 'boolean', title: 'Is Bot' },
            first_name: { type: 'string', title: 'First Name' },
            last_name: { type: 'string', title: 'Last Name' },
            username: { type: 'string', title: 'Username' }
        },
        example: { id: 6412345678, is_bot: false, first_name: 'Jana', username: 'jana_novakova' }
    },
    is_anonymous: { type: 'boolean', title: 'Is Anonymous', example: false },
    custom_title: { type: 'string', title: 'Custom Title', example: 'Owner' },
    can_manage_chat: { type: 'boolean', title: 'Can Manage Chat', example: true },
    can_delete_messages: { type: 'boolean', title: 'Can Delete Messages', example: true },
    can_restrict_members: { type: 'boolean', title: 'Can Restrict Members', example: true },
    can_promote_members: { type: 'boolean', title: 'Can Promote Members', example: false },
    can_change_info: { type: 'boolean', title: 'Can Change Info', example: true },
    can_invite_users: { type: 'boolean', title: 'Can Invite Users', example: true },
    can_pin_messages: { type: 'boolean', title: 'Can Pin Messages', example: true },
    can_post_messages: { type: 'boolean', title: 'Can Post Messages', example: false }
};

module.exports = {

    async receive(context) {

        const { chatId, outputType = 'array' } = context.messages.in.content;

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Administrators' });
        }

        if (!chatId) {
            throw new context.CancelError('Chat ID is required!');
        }

        const records = await lib.apiRequest(context, 'getChatAdministrators', { chat_id: chatId });

        return lib.sendArrayOutput({ context, outputType, records: records || [] });
    }
};
