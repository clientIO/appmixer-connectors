'use strict';
module.exports = context => {

    /** Model for component SetBlockIPRule */
    class BlockIPRuleModel extends context.db.Model {

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
                'ips',
                'removeAfter',
                'created',
                'auth'
            ];
        }
    }

    BlockIPRuleModel.createSettersAndGetters();

    return BlockIPRuleModel;
};

