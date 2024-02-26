'use strict';
var assert = require('assert');
var SendEmail = require('../../SendEmail');

describe('SendEmail', function() {

    var component;

    before(function() {

        // minimal constructor for the SendEmail component
        var constructor = {

            'id': 'Doesn\'t matter, but required.',
            'coordinatorId': 'Doesn\'t matter, but required.',
            'flowId': 'Doesn\'t matter, but required.',
            'manifest': require('../../component.json') // load the manifest
        };

        // important for standalone spawning
        constructor.mode = 'static';

        // create the instance
        component = new SendEmail(constructor);

        constructor.manifest.quota.scope = 'testUserId';

        component.setQuotaConfig(constructor.manifest.quota);

        // if there is need for authorization for the component, here is the place
        component.setAuth(constructor.manifest.auth);

        // SendEmail doesn't need any property
        var properties = {};
        component.configure(properties);
    });

    it('should send the test email', function(done) {

        this.timeout(10000);

        var inMessages = {
            in: Buffer.from(JSON.stringify({
                'sender': 'tomas.waldauf@gmail.com',
                'from': 'Grid',
                'to': 'tomas.waldauf@gmail.com',
                'subject': 'Hello, Grid here!',
                'text': 'Kiss my ass!'
            }))
        };

        component.input(inMessages, function(error, messages) {

            // TBD:
            // see: GRID-165 - component testing support
            done(error);
        });
    });
});
