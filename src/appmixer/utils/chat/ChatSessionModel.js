'use strict';

module.exports = context => {

    class ChatSessionModel extends context.db.Model {

        static get collection() {

            return 'chat_sessions';
        }

        static get idProperty() {

            return 'id';
        }

        static get properties() {

            return [
                'id',
                'userId',
                'componentId',
                'flowId',
                'createdAt'
            ];
        }
    }

    ChatSessionModel.createSettersAndGetters();

    return ChatSessionModel;
};