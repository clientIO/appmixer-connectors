'use strict';
module.exports = context => {

    class RuleModel extends context.db.Model {

        static get collection() {

            return 'rules';
        }

        static get idProperty() {

            return 'taskId';
        }

        static get properties() {

            return [
                'ruleId',
                'siteId',
                'removeAfter',
                'created',
                'auth'
            ];
        }
    }

    RuleModel.createSettersAndGetters();

    return RuleModel;
};

