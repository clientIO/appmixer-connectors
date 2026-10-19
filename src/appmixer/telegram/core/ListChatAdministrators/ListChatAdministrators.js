'use strict';

const lib = require('../../lib');

// The out port is dynamic (outputType), so the item contract is exported for the offline tooling.
// It drives both the emitted records and the dynamic output port options, so every leaf needs
// a type, a human title and a realistic example - those become the variable picker entries.
const ITEM_SCHEMA = {
    type: 'object',
    properties: {
        status: { type: 'string', title: 'Status', example: 'administrator' },
        user: {
            type: 'object',
            title: 'User',
            properties: {
                id: { type: 'integer', title: 'User.ID', example: 6412345678 },
                is_bot: { type: 'boolean', title: 'User.Is Bot', example: false },
                first_name: { type: 'string', title: 'User.First Name', example: 'Jana' },
                last_name: { type: 'string', title: 'User.Last Name', example: 'Novakova' },
                username: { type: 'string', title: 'User.Username', example: 'jana_novakova' }
            },
            required: ['id', 'is_bot', 'first_name'],
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
    },
    // Telegram always sends the status and the user; the rights depend on the member's role.
    required: ['status', 'user']
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { chatId, outputType = 'array' } = context.messages.in.content;

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Administrators' });
        }

        if (!chatId) {
            throw new context.CancelError('Chat ID is required!');
        }

        const records = await lib.apiRequest(context, 'getChatAdministrators', { chat_id: chatId });

        return lib.sendArrayOutput({ context, outputType, records: records || [] });
    }
};
