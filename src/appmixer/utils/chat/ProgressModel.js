'use strict';
module.exports = context => {

    class ProgressModel extends context.db.Model {

        static get collection() {

            return 'chat_progress';
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
                'createdAt',
                'expireAt'
            ];
        }
    }

    ProgressModel.createSettersAndGetters();

    return ProgressModel;
};
