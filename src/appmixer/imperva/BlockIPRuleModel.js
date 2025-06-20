'use strict';

module.exports = context => {

    /** Model for component SetBlockIPRule. Collection name: pluginAppmixerImpervaBlockIPRules */
    class BlockIPRuleModel extends context.db.Model {

        static get collection() {

            return 'blockIPRules';
        }

        static get idProperty() {

            return 'ruleId';
        }

        static get properties() {

            return [
                'ruleId',
                'siteId',
                'ip',
                'removeAfter',
                'auth'
            ];
        }
    }

    BlockIPRuleModel.createSettersAndGetters();

    return BlockIPRuleModel;
};

