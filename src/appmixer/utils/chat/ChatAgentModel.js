'use strict';

module.exports = context => {

    class ChatAgentModel extends context.db.Model {

        static get collection() {

            return 'chat_agents';
        }

        static get idProperty() {

            return 'id';
        }

        static get properties() {

            return [
                'id',
                'name',
                'message',
                'avatar',
                'userId',
                'componentId',
                'flowId',
                'createdAt'
            ];
        }

        static async deleteById(id) {

            return context.db.collection(this.collection)
                .deleteOne({ [this.idProperty]: id });
        }
    }

    ChatAgentModel.createSettersAndGetters();

    return ChatAgentModel;
};
