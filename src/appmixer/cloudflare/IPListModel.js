'use strict';

module.exports = context => {

    class IPListModel extends context.db.Model {

        static get collection() {

            return 'ipList';
        }

        static get idProperty() {

            return 'id';
        }

        static get properties() {

            return [
                'id',
                'ip',
                'removeAfter',
                'auth'
            ];
        }
    }

    IPListModel.createSettersAndGetters();

    return IPListModel;
};

