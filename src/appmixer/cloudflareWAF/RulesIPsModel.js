'use strict';

module.exports = context => {

    class RulesIPsModel extends context.db.Model {

        static get collection() {

            return 'rulesIPsModel';
        }

        static get idProperty() {

            return 'id';
        }

        static get properties() {

            return [
                'id',
                'ip',
                'ruleId',
                'rulesetId',
                'zoneId',
                'removeAfter',
                'auth',
                'mtime'
            ];
        }
    }

    RulesIPsModel.createSettersAndGetters();

    return RulesIPsModel;
};

