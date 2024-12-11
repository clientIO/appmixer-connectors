'use strict';

module.exports = context => {

    /** Model for component SetBlockIPRule. Collection name: pluginAppmixerImpervaBlockIPRules */
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
                'auth',
                'mtime'
            ];
        }
    }

    IPListModel.createSettersAndGetters();

    return IPListModel;
};

