const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('Token Scope Test', function() {
    let context;
    
    this.timeout(30000);
    
    before(function() {
        // Mock context
        context = {
            auth: {
                accessToken: process.env.GOOGLE_DOCS_ACCESS_TOKEN
            },
            httpRequest: require('./httpRequest.js')
        };
        
        if (!context.auth.accessToken) {
            throw new Error('GOOGLE_DOCS_ACCESS_TOKEN environment variable is required for tests');
        }
    });
    
    it('should test what scopes the token has', async function() {
        try {
            // Test token info
            const tokenInfo = await context.httpRequest({
                method: 'GET',
                url: `https://www.googleapis.com/oauth2/v2/tokeninfo?access_token=${context.auth.accessToken}`
            });
            console.log('Token info:', JSON.stringify(tokenInfo.data, null, 2));
        } catch (error) {
            console.log('Token info error:', error.message);
        }
        
        try {
            // Test Google Drive API (this should work)
            const driveResponse = await context.httpRequest({
                method: 'GET',
                url: 'https://www.googleapis.com/drive/v3/files',
                params: {
                    q: "mimeType='application/vnd.google-apps.document'",
                    pageSize: 1
                },
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`
                }
            });
            console.log('Drive API works:', driveResponse.status);
        } catch (error) {
            console.log('Drive API error:', error.message);
        }
        
        try {
            // Test creating document via Drive API instead of Docs API
            const driveCreateResponse = await context.httpRequest({
                method: 'POST',
                url: 'https://www.googleapis.com/drive/v3/files',
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    name: 'Test Document via Drive API',
                    mimeType: 'application/vnd.google-apps.document'
                }
            });
            console.log('Drive API document creation works:', driveCreateResponse.status);
            console.log('Created document:', JSON.stringify(driveCreateResponse.data, null, 2));
        } catch (error) {
            console.log('Drive API document creation error:', error.message);
            if (error.response) {
                console.log('Error response:', JSON.stringify(error.response.data, null, 2));
            }
        }
        
        try {
            // Test Google Docs API directly
            const docsResponse = await context.httpRequest({
                method: 'POST',
                url: 'https://docs.googleapis.com/v1/documents',
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    title: 'Test Document via Docs API'
                }
            });
            console.log('Docs API works:', docsResponse.status);
        } catch (error) {
            console.log('Docs API error:', error.message);
            if (error.response) {
                console.log('Error response:', JSON.stringify(error.response.data, null, 2));
            }
        }
    });
});
