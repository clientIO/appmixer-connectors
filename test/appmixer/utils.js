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
        scope: ['offline_access'],
        httpRequest: sinon.stub(),
        accessToken: 'testAccessToken',
        profileInfo: {
            fullname: 'testFullname',
            internalemailaddress: 'testEmail',
            systemuserid: 'testUserId'
        },
        lock: sinon.stub(),
        log: console.log,
        CancelError: Error,
        sendJson: sinon.stub(),
        staticCache: {
            get: sinon.stub(),
            set: sinon.stub()
        },
        componentStaticCall: sinon.stub()
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
