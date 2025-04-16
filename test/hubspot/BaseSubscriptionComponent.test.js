const assert = require('assert');
const testUtils = require('../utils.js');
const Base = require('../../src/appmixer/hubspot/BaseSubscriptionComponent.js');

// Simulates eg UpdatedContact component
class TestComponent extends Base {

    async getSubscriptions() {
        return [];
    }
    // We don't want to call the actual API
    subscribe() {
        return Promise.resolve();
    }
    deleteSubscriptions() {
        return Promise.resolve();
    }
}

describe('BaseSubscriptionComponent', () => {

    let context = testUtils.createMockContext();

    beforeEach(async () => {

        // Reset the context.
        context = testUtils.createMockContext();
        // Set the profile info.
        context.auth.profileInfo = {
            token: 'CJSP5qf1KhICAQEYs-gDIIGOBii1hQIyGQAf3xBKmlwHjX7OIpuIFEavB2-qYAGQsF4',
            user: 'test@hubspot.com',
            hub_domain: 'demo.hubapi.com',
            scopes: [
                'contacts',
                'automation',
                'oauth'
            ],
            hub_id: 33,
            app_id: 456,
            expires_in: 21588,
            user_id: 123,
            token_type: 'access'
        };
    });

    it('should register triggers', async () => {

        // Register the triggers
        const component = new TestComponent('contact.PropertyChange');
        await component.start(context);

        const addListenerArgs = context.addListener.getCall(0).args[0];
        assert.equal(addListenerArgs, 'contact.PropertyChange:33', 'The trigger component should be registered by Appmixer.');
    });

    it('should unsubscribe', async () => {

        // Unsubscribe
        const component = new TestComponent('contact.PropertyChange');
        await component.stop(context);

        const removeListenerArgs = context.removeListener.getCall(0).args[0];
        assert.equal(removeListenerArgs, 'contact.PropertyChange:33', 'The trigger component should be unregistered by Appmixer.');
    });

});
