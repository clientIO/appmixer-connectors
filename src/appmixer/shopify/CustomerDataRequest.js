module.exports = context => {

    class CustomerDataRequest extends context.db.Model {

        static get collection() {
            return 'customerDataRequests_temp_1';
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

    CustomerDataRequest.createSettersAndGetters();

    return CustomerDataRequest;
};
