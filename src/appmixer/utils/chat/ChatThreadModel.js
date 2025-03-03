'use strict';

module.exports = context => {

    class ChatThreadModel extends context.db.Model {

        static get collection() {

            return 'chat_threads';
        }

        static get idProperty() {

            return 'id';
        }

        static get properties() {

            return [
                'id',
                'agentId',
                'sessionId',
                'theme',
                'createdAt'
            ];
        }

        static async deleteById(id) {

            return context.db.collection(this.collection)
                .deleteOne({ [this.idProperty]: id });
        }
    }

    ChatThreadModel.createSettersAndGetters();

    return ChatThreadModel;
};
