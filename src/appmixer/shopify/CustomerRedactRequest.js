module.exports = context => {

    class CustomerRedactRequest extends context.db.Model {

        static get collection() {
            return 'customerRedactsRequests';
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
