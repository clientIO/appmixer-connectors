'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

/**
 * Local HTTPS test server helper for testing SSL/TLS certificate support
 * Creates an HTTPS server with self-signed certificate at localhost:8443
 * Certificates are generated on-demand in temp directory during test execution
 */

// Use temp directory for certificates to avoid storing them in git
const CERTS_DIR = path.join(os.tmpdir(), 'appmixer-test-certs-' + process.pid);
let generatedCerts = false;

/**
 * Get paths to certificate files
 * @returns {{key: string, cert: string, ca: string}}
 */
function getCertPaths() {
    return {
        key: path.join(CERTS_DIR, 'server-key.pem'),
        cert: path.join(CERTS_DIR, 'server-cert.pem'),
        ca: path.join(CERTS_DIR, 'ca-cert.pem'),
        clientCert: path.join(CERTS_DIR, 'client-cert.pem'),
        clientKey: path.join(CERTS_DIR, 'client-key.pem')
    };
}

/**
 * Generate certificates on-demand if needed
 * @returns {Promise<boolean>} True if certificates were generated or already exist
 */
async function ensureCertsGenerated() {
    if (generatedCerts && certsExist()) {
        return true;
    }

    // Create certs directory if needed
    if (!fs.existsSync(CERTS_DIR)) {
        fs.mkdirSync(CERTS_DIR, { recursive: true });
    }

    try {
        // Set environment variable for the generation script
        process.env.APPMIXER_TEST_CERTS_DIR = CERTS_DIR;
        const generateCerts = require('./certs/generate-certs');
        await generateCerts();
        generatedCerts = true;
        return true;
    } catch (error) {
        console.error('Failed to generate certificates:', error.message);
        return false;
    }
}

/**
 * Check if certificates exist
 * @returns {boolean}
 */
function certsExist() {
    const { key, cert, ca } = getCertPaths();
    return fs.existsSync(key) && fs.existsSync(cert) && fs.existsSync(ca);
}

/**
 * Create and start an HTTPS test server
 * @param {Object} options - Server options
 * @param {number} [options.port=8443] - Port to listen on
 * @param {boolean} [options.requestCert=false] - Request client certificate
 * @param {boolean} [options.rejectUnauthorized=true] - Reject unauthorized clients
 * @return {Promise<{server: https.Server, url: string, close: Function}>}
 */
async function startHttpsTestServer(options = {}) {
    const {
        port = 8443,
        requestCert = false,
        rejectUnauthorized = true
    } = options;

    // Generate certificates on demand if needed
    const certsReady = await ensureCertsGenerated();
    if (!certsReady) {
        throw new Error(
            `Failed to generate certificates in ${CERTS_DIR}`
        );
    }

    const { key, cert, ca } = getCertPaths();

    const serverOptions = {
        key: fs.readFileSync(key),
        cert: fs.readFileSync(cert),
        requestCert,
        rejectUnauthorized
    };

    // If requiring client certs, include the CA
    if (requestCert && !rejectUnauthorized) {
        serverOptions.ca = fs.readFileSync(ca);
    }

    return new Promise((resolve, reject) => {
        const server = https.createServer(serverOptions, (req, res) => {
            // Handle various endpoints
            if (req.url === '/json') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'HTTPS test server response',
                    method: req.method,
                    path: req.url
                }));
            } else if (req.url === '/upload') {
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });
                req.on('end', () => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: 'File uploaded',
                        contentLength: body.length
                    }));
                });
            } else if (req.url === '/client-cert-info') {
                // Return info about client certificate if provided
                const clientCert = req.socket.getPeerCertificate();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    clientCertPresent: !!clientCert && !!clientCert.subject,
                    clientSubject: clientCert ? clientCert.subject : null
                }));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Test server OK'
                }));
            }
        });

        server.on('error', reject);

        server.listen(port, 'localhost', () => {
            // When port 0 is used, the system assigns an ephemeral port.
            // Use server.address().port to determine the actual listening port.
            const actualPort = server.address().port;
            const url = `https://localhost:${actualPort}`;
            resolve({
                server,
                url,
                close: () => {
                    return new Promise((resolveClose) => {
                        // Node < 19 does not close idle keep-alive connections on close(),
                        // so the undici agent's pooled sockets would keep the server alive.
                        if (typeof server.closeAllConnections === 'function') {
                            server.closeAllConnections();
                        }
                        server.close(resolveClose);
                    });
                }
            });
        });
    });
}

module.exports = {
    startHttpsTestServer,
    getCertPaths,
    certsExist,
    ensureCertsGenerated,
    CERTS_DIR
};
