module.exports = context => {

    class CustomerRedactRequest extends context.db.Model {

        static get collection() {
            return 'customerRedactsRequests_temp_1';
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

    CustomerRedactRequest.createSettersAndGetters();

    return CustomerRedactRequest;
};
