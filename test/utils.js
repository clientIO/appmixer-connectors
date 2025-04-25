const fs = require('fs');
const path = require('path');
const sinon = require('sinon');

function getComponentJsonFiles(dir) {

    const files = fs.readdirSync(dir);
    const componentJsonFiles = [];

    files.forEach(file => {

        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            componentJsonFiles.push(...getComponentJsonFiles(filePath));
        } else if (file.endsWith('component.json')) {
            if (filePath.indexOf('node_modules') !== -1) {
                return;
            }
            componentJsonFiles.push(filePath);
        }
    });

    return componentJsonFiles;
}

function getPackageJsonFiles(dir) {

    const files = fs.readdirSync(dir);
    const componentJsonFiles = [];

    files.forEach(file => {

        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            componentJsonFiles.push(...getPackageJsonFiles(filePath));
        } else if (file.endsWith('package.json')) {
            // Not interested in the package.json files in the node_modules folder.
            if (filePath.indexOf('node_modules') !== -1) {
                return;
            }
            componentJsonFiles.push(filePath);
        }
    });

    return componentJsonFiles;
}

function createMockContext(options) {

    global.serviceState = {};

    // Reset fake timers
    sinon.restore();

    const context = {
        clientId: 'testClientId',
        clientSecret: 'testClientSecret',
        auth: {
            clientId: 'testClientId',
            clientSecret: 'testClientSecret'
        },
        config: {},
        authorizationCode: 'testAuthorizationCode',
        callbackUrl: 'testCallbackUrl',
        ticket: 'testTicket',
        componentId: 'componentId-1',
        flowDescriptor: {
            'componentId-1': {
                label: 'Foo'
            }
        },
        scope: ['offline_access'],
        httpRequest: sinon.stub(),
        accessToken: 'testAccessToken',
        profileInfo: {
            fullname: 'testFullname',
            internalemailaddress: 'testEmail',
            systemuserid: 'testUserId'
        },
        log: sinon.stub().callsFake((...args) => console.log(...args)),
        lock: sinon.stub().returns({ unlock: sinon.stub() }),
        CancelError: Error,
        sendJson: sinon.stub(),
        sendArray: sinon.stub(),
        response: sinon.stub(),
        callAppmixer: sinon.stub().throws(new Error('Not implemented')),
        service: {
            stateSet: sinon.stub().callsFake((key, value) => {
                global.serviceState[key] = value;
            }),
            stateGet: sinon.stub().callsFake(key => {
                return global.serviceState[key];
            }),
            stateUnset: sinon.stub().callsFake(key => {
                delete global.serviceState[key];
            }),
            stateAddToSet: sinon.stub()
        },
        staticCache: {
            get: sinon.stub().callsFake(key => {
                return global.serviceState[key];
            }),
            set: sinon.stub().callsFake((key, value, ttl) => {
                global.serviceState[key] = value;
                if (ttl) {
                    setTimeout(() => {
                        delete global.serviceState[key];
                    }, ttl);
                }
            })
        },
        componentStaticCall: sinon.stub(),
        getWebhookUrl: sinon.stub(),
        saveState: sinon.stub().returns({}),
        setTimeout: sinon.stub(),
        triggerComponent: sinon.stub(),
        triggerListeners: sinon.stub(),
        removeListener: sinon.stub(),
        addListener: sinon.stub(),
        onListenerAdded: sinon.stub(),
        getFileReadStream: sinon.stub().throws(new Error('Not implemented')),
        replaceFileStream: sinon.stub().throws(new Error('Not implemented')),
        db: {
            Model: class {
                static createSettersAndGetters() {
                    return sinon.stub();
                }
                populate = sinon.stub().returns({
                    save: sinon.stub().resolves({})
                });
            },
            // Mock `collection` as mongo model
            collection: sinon.stub().returns({
                insertMany: sinon.stub(),
                deleteMany: sinon.stub(),
                updateMany: sinon.stub(),
                find: sinon.stub().returns({
                    toArray: sinon.stub().resolves([]) // Mock the toArray method to return an empty array
                })
            })
        },
        utils: {
            Error: {
                stringify: sinon.stub().callsFake((...args) => {
                    console.log('Error.stringify', ...args);
                    return args;
                })
            }
        },
        job: {
            lock: sinon.stub().returns({ unlock: sinon.stub() })
        },
        properties:{}
    };

    if (options) {
        Object.assign(context, options);
    }

    return context;
}

module.exports = {
    getComponentJsonFiles,
    getPackageJsonFiles,
    createMockContext
};
