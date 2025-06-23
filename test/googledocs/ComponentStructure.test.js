const path = require('path');

describe('Google Docs Components Structure Tests', function() {
    let components;
    
    before(function() {
        // Load all component modules
        components = {
            CreateDocument: require(path.join(__dirname, '../../src/appmixer/googledocs/core/CreateDocument/CreateDocument.js')),
            FindDocuments: require(path.join(__dirname, '../../src/appmixer/googledocs/core/FindDocuments/FindDocuments.js')),
            GetDocumentContent: require(path.join(__dirname, '../../src/appmixer/googledocs/core/GetDocumentContent/GetDocumentContent.js')),
            InsertParagraph: require(path.join(__dirname, '../../src/appmixer/googledocs/core/InsertParagraph/InsertParagraph.js')),
            ReplaceText: require(path.join(__dirname, '../../src/appmixer/googledocs/core/ReplaceText/ReplaceText.js')),
            DeleteDocument: require(path.join(__dirname, '../../src/appmixer/googledocs/core/DeleteDocument/DeleteDocument.js')),
            CreateDocumentfromTemplate: require(path.join(__dirname, '../../src/appmixer/googledocs/core/CreateDocumentfromTemplate/CreateDocumentfromTemplate.js')),
            InsertImage: require(path.join(__dirname, '../../src/appmixer/googledocs/core/InsertImage/InsertImage.js')),
            ReplaceImage: require(path.join(__dirname, '../../src/appmixer/googledocs/core/ReplaceImage/ReplaceImage.js')),
            DownloadDocument: require(path.join(__dirname, '../../src/appmixer/googledocs/core/DownloadDocument/DownloadDocument.js')),
            WatchDocuments: require(path.join(__dirname, '../../src/appmixer/googledocs/core/WatchDocuments/WatchDocuments.js'))
        };
    });
    
    it('should have all required components with receive method', function() {
        const requiredComponents = [
            'CreateDocument', 'FindDocuments', 'GetDocumentContent', 
            'InsertParagraph', 'ReplaceText', 'DeleteDocument',
            'CreateDocumentfromTemplate', 'InsertImage', 'ReplaceImage',
            'DownloadDocument', 'WatchDocuments'
        ];
        
        for (const componentName of requiredComponents) {
            if (!components[componentName]) {
                throw new Error(`Component ${componentName} not found`);
            }
            if (typeof components[componentName].receive !== 'function') {
                throw new Error(`Component ${componentName} does not have a receive method`);
            }
        }
    });
    
    it('should have proper component.json files', function() {
        const fs = require('fs');
        const requiredComponents = [
            'CreateDocument', 'FindDocuments', 'GetDocumentContent', 
            'InsertParagraph', 'ReplaceText', 'DeleteDocument',
            'CreateDocumentfromTemplate', 'InsertImage', 'ReplaceImage',
            'DownloadDocument', 'WatchDocuments'
        ];
        
        for (const componentName of requiredComponents) {
            const componentJsonPath = path.join(__dirname, `../../src/appmixer/googledocs/core/${componentName}/component.json`);
            if (!fs.existsSync(componentJsonPath)) {
                throw new Error(`Component JSON file not found for ${componentName}`);
            }
            
            const componentJson = JSON.parse(fs.readFileSync(componentJsonPath, 'utf8'));
            
            // Verify required fields
            if (!componentJson.name) {
                throw new Error(`Component ${componentName} missing name field`);
            }
            if (!componentJson.auth) {
                throw new Error(`Component ${componentName} missing auth field`);
            }
            if (componentJson.auth.service !== 'appmixer:googledocs') {
                throw new Error(`Component ${componentName} has incorrect auth service: ${componentJson.auth.service}`);
            }
            if (!componentJson.inPorts || !Array.isArray(componentJson.inPorts)) {
                throw new Error(`Component ${componentName} missing or invalid inPorts`);
            }
            if (!componentJson.outPorts || !Array.isArray(componentJson.outPorts)) {
                throw new Error(`Component ${componentName} missing or invalid outPorts`);
            }
        }
    });
    
    it('should have consistent quota manager references', function() {
        const fs = require('fs');
        const requiredComponents = [
            'CreateDocument', 'FindDocuments', 'GetDocumentContent', 
            'InsertParagraph', 'ReplaceText', 'DeleteDocument',
            'CreateDocumentfromTemplate', 'InsertImage', 'ReplaceImage',
            'DownloadDocument', 'WatchDocuments'
        ];
        
        for (const componentName of requiredComponents) {
            const componentJsonPath = path.join(__dirname, `../../src/appmixer/googledocs/core/${componentName}/component.json`);
            const componentJson = JSON.parse(fs.readFileSync(componentJsonPath, 'utf8'));
            
            if (componentJson.quota && componentJson.quota.manager !== 'appmixer:googledocs') {
                throw new Error(`Component ${componentName} has incorrect quota manager: ${componentJson.quota.manager}`);
            }
        }
    });
    
    it('should have service.json with correct configuration', function() {
        const fs = require('fs');
        const serviceJsonPath = path.join(__dirname, '../../src/appmixer/googledocs/service.json');
        
        if (!fs.existsSync(serviceJsonPath)) {
            throw new Error('service.json not found');
        }
        
        const serviceJson = JSON.parse(fs.readFileSync(serviceJsonPath, 'utf8'));
        
        if (serviceJson.name !== 'appmixer.googledocs') {
            throw new Error(`Incorrect service name: ${serviceJson.name}`);
        }
        if (!serviceJson.label) {
            throw new Error('Service missing label');
        }
        if (!serviceJson.description) {
            throw new Error('Service missing description');
        }
        if (!serviceJson.icon) {
            throw new Error('Service missing icon');
        }
    });
    
    it('should have auth.js with OAuth2 configuration', function() {
        const fs = require('fs');
        const authPath = path.join(__dirname, '../../src/appmixer/googledocs/auth.js');
        
        if (!fs.existsSync(authPath)) {
            throw new Error('auth.js not found');
        }
        
        const auth = require(authPath);
        
        if (auth.type !== 'oauth2') {
            throw new Error(`Incorrect auth type: ${auth.type}`);
        }
        if (typeof auth.definition !== 'function') {
            throw new Error('Auth definition should be a function');
        }
    });
});
