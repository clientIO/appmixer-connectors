'use strict';
module.exports = context => {

    class AppEventTriggerModel extends context.db.Model {

        static get collection() {

            return 'appevent_triggers';
        }

        static get idProperty() {

            return 'componentId';
        }

        static get properties() {

            return [
                'userId',
                'event',
                'componentId',
                'flowId',
                'createdAt'
            ];
        }
    }

    AppEventTriggerModel.createSettersAndGetters();

    return AppEventTriggerModel;
};
