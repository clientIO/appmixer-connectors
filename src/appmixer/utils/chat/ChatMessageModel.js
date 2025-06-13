'use strict';
module.exports = context => {

    class ChatMessageModel extends context.db.Model {

        static get collection() {

            return 'chat_messages';
        }

        static get idProperty() {

            return 'id';
        }

        static get properties() {

            return [
                'id',
                'content',
                'role',  // 'user' or 'agent'
                'threadId',
                'userId',
                'componentId',
                'flowId',
                'createdAt'
            ];
        }
    }

    ChatMessageModel.createSettersAndGetters();

    return ChatMessageModel;
};
