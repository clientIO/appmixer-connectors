'use strict';

const https = require('https');

async function createTestDocument(title, accessToken) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ title });

        const options = {
            hostname: 'docs.googleapis.com',
            port: 443,
            path: '/v1/documents',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                resolve({ data: JSON.parse(responseData) });
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function batchUpdateDocument(documentId, requests, accessToken) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ requests });

        const options = {
            hostname: 'docs.googleapis.com',
            port: 443,
            path: `/v1/documents/${documentId}:batchUpdate`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                resolve({ data: responseData ? JSON.parse(responseData) : {} });
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

module.exports = {
    createTestDocument,
    batchUpdateDocument
};
