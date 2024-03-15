module.exports = context => {

    class ShopRedactRequest extends context.db.Model {

        static get collection() {
            return 'shopRedactRequests_temp_1';
        }

        static get idProperty() {
            return 'id';
        }

        static get properties() {

            return [
                'id',
                'request',
                'created'
            ];
        }
    }

    ShopRedactRequest.createSettersAndGetters();

    return ShopRedactRequest;
};

