'use strict';

module.exports = {

    registerSignalReceiver(context) {

        // register itself, this is a test framework component, there should be a BeforeAll in the flow
        // as well, that BeforeAll will send a signal before the test run starts and it will count signals
        // from all registered components - from all CallCount components in the flow (for example). Only after
        // it receives all signals back, it will start the test run
        return context.flow.stateAddToSet(
            'signalReceivers',
            {
                componentId: context.componentId,
                componentType: context.componentType
            }
        );
    },

    get STATE() {

        return 'state';
    }
};
